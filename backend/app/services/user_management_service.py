"""
User Management Service for Hierarchical Role System
Handles user creation, hierarchy management, and Keycloak integration
"""

import uuid
import asyncio
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.models.auth import (
    User, UserRole, UserStatus, UserHierarchy, ClassAssignment,
    UserCreationRequest, UserAssignmentRequest
)
from app.config.settings import settings


class KeycloakService:
    """Service for Keycloak user management"""
    
    def __init__(self):
        # These should be configured in settings
        self.keycloak_url = "https://auth.idtcities.com"
        self.realm = "embedder"
        self.client_id = "embedder-client"
        self.admin_username = settings.keycloak_admin_username if hasattr(settings, 'keycloak_admin_username') else None
        self.admin_password = settings.keycloak_admin_password if hasattr(settings, 'keycloak_admin_password') else None
        self._admin_token = None
        self._token_expires = None

    async def get_admin_token(self) -> str:
        """Get admin access token for Keycloak operations"""
        if self._admin_token and self._token_expires and datetime.now() < self._token_expires:
            return self._admin_token
            
        if not self.admin_username or not self.admin_password:
            print("ERROR: Keycloak admin credentials not configured")
            print(f"DEBUG: Username configured: {bool(self.admin_username)}")
            print(f"DEBUG: Password configured: {bool(self.admin_password)}")
            raise ValueError("Keycloak admin credentials not configured")
            
        token_url = f"{self.keycloak_url}/realms/master/protocol/openid-connect/token"
        data = {
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": self.admin_username,
            "password": self.admin_password
        }
        
        response = requests.post(token_url, data=data)
        response.raise_for_status()
        
        token_data = response.json()
        self._admin_token = token_data["access_token"]
        # Set expiry a bit before actual expiry for safety
        expires_in = token_data.get("expires_in", 300) - 30
        self._token_expires = datetime.now() + timedelta(seconds=expires_in)
        
        return self._admin_token

    async def create_keycloak_user(self, user_request: UserCreationRequest) -> str:
        """Create user in Keycloak and return user ID"""
        try:
            print(f"DEBUG: Creating Keycloak user: {user_request.username}")
            token = await self.get_admin_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Create user payload
            user_payload = {
                "username": user_request.username,
                "email": user_request.email,
                "firstName": user_request.name.split()[0] if user_request.name else user_request.username,
                "lastName": " ".join(user_request.name.split()[1:]) if len(user_request.name.split()) > 1 else "",
                "enabled": True,
                "emailVerified": True,
                "credentials": [{
                    "type": "password",
                    "value": user_request.password,
                    "temporary": False
                }]
            }
            
            # Create user
            users_url = f"{self.keycloak_url}/admin/realms/{self.realm}/users"
            response = requests.post(users_url, json=user_payload, headers=headers)
            response.raise_for_status()
            
            # Get created user ID from Location header
            location = response.headers.get("Location")
            if location:
                user_id = location.split("/")[-1]
            else:
                # Fallback: search for user
                search_url = f"{users_url}?username={user_request.username}"
                search_response = requests.get(search_url, headers=headers)
                search_response.raise_for_status()
                users = search_response.json()
                if users:
                    user_id = users[0]["id"]
                else:
                    raise ValueError("Failed to get created user ID")
            
            # Assign role to user
            await self.assign_role_to_user(user_id, user_request.role.value)
            
            return user_id
            
        except Exception as e:
            print(f"ERROR: Failed to create Keycloak user: {str(e)}")
            print(f"ERROR: User request: {user_request}")
            raise

    async def assign_role_to_user(self, user_id: str, role_name: str):
        """Assign role to user in Keycloak"""
        try:
            token = await self.get_admin_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Get client internal ID
            clients_url = f"{self.keycloak_url}/admin/realms/{self.realm}/clients"
            clients_response = requests.get(f"{clients_url}?clientId={self.client_id}", headers=headers)
            clients_response.raise_for_status()
            clients = clients_response.json()
            
            if not clients:
                raise ValueError(f"Client {self.client_id} not found")
                
            client_internal_id = clients[0]["id"]
            
            # Get role
            roles_url = f"{self.keycloak_url}/admin/realms/{self.realm}/clients/{client_internal_id}/roles/{role_name}"
            role_response = requests.get(roles_url, headers=headers)
            role_response.raise_for_status()
            role = role_response.json()
            
            # Assign role to user
            assign_url = f"{self.keycloak_url}/admin/realms/{self.realm}/users/{user_id}/role-mappings/clients/{client_internal_id}"
            assign_response = requests.post(assign_url, json=[role], headers=headers)
            assign_response.raise_for_status()
            
        except Exception as e:
            print(f"Error assigning role to user: {str(e)}")
            raise

    async def delete_keycloak_user(self, user_id: str):
        """Delete user from Keycloak"""
        try:
            token = await self.get_admin_token()
            headers = {"Authorization": f"Bearer {token}"}
            
            delete_url = f"{self.keycloak_url}/admin/realms/{self.realm}/users/{user_id}"
            response = requests.delete(delete_url, headers=headers)
            response.raise_for_status()
            
        except Exception as e:
            print(f"Error deleting Keycloak user: {str(e)}")
            raise


class UserManagementService:
    """Service for managing hierarchical user relationships"""
    
    def __init__(self, mongodb_uri: str, db_name: str):
        self.client = AsyncIOMotorClient(mongodb_uri)
        self.db: AsyncIOMotorDatabase = self.client[db_name]
        self.keycloak = KeycloakService()
        
    # ========== Role Hierarchy Management ==========
    
    def get_role_level(self, role: UserRole) -> int:
        """Get numeric level for role (0 = highest authority)"""
        role_levels = {
            UserRole.ADMIN: 0,
            UserRole.SUPERVISOR: 1,
            UserRole.TEACHER: 2,
            UserRole.STUDENT: 3
        }
        return role_levels.get(role, 999)
    
    def can_create_role(self, creator_role: UserRole, target_role: UserRole) -> bool:
        """Check if creator can create user with target role"""
        creator_level = self.get_role_level(creator_role)
        target_level = self.get_role_level(target_role)
        return creator_level < target_level
    
    def can_manage_user(self, manager_role: UserRole, target_role: UserRole) -> bool:
        """Check if manager can manage target user"""
        manager_level = self.get_role_level(manager_role)
        target_level = self.get_role_level(target_role)
        return manager_level < target_level
    
    def get_accessible_pages(self, role: UserRole) -> List[str]:
        """Get list of pages accessible to role"""
        pages = {
            UserRole.ADMIN: ["upload", "documents", "chat", "search", "config", "health", "users"],
            UserRole.SUPERVISOR: ["upload", "documents", "chat", "search", "users"],
            UserRole.TEACHER: ["upload", "documents", "chat", "users"],
            UserRole.STUDENT: ["chat", "users"]
        }
        return pages.get(role, [])
    
    # ========== User Management ==========
    
    async def create_user(self, creator_id: str, user_request: UserCreationRequest) -> Dict[str, Any]:
        """Create new user with hierarchy validation"""
        try:
            # Get creator info
            creator = await self.get_user(creator_id)
            if not creator:
                # Creator doesn't exist in database, but we can still create users
                # This happens when the admin user exists in Keycloak but not in our database
                print(f"DEBUG: Creator {creator_id} not found in database, but proceeding with user creation")
                # We'll need to get the creator role from the current user context
                # For now, assume admin can create any role
                creator_role = UserRole.ADMIN  # Default assumption for Keycloak users
            else:
                creator_role = UserRole(creator["role"])
            
            # Validate role hierarchy
            if not self.can_create_role(creator_role, user_request.role):
                raise ValueError(f"{creator_role.value} cannot create {user_request.role.value}")
            
            print(f"DEBUG: Creating user {user_request.username} with role {user_request.role.value}")
            print(f"DEBUG: Creator role: {creator_role.value}")
            
            # Create user in Keycloak first
            keycloak_user_id = await self.keycloak.create_keycloak_user(user_request)
            print(f"DEBUG: Created Keycloak user with ID: {keycloak_user_id}")
            
            # Create user in our database
            now = datetime.utcnow()
            user_doc = {
                "user_id": keycloak_user_id,
                "sub": keycloak_user_id,
                "username": user_request.username,
                "email": user_request.email,
                "name": user_request.name,
                "role": user_request.role.value,
                "status": UserStatus.ACTIVE.value,
                "created_by": creator_id,
                "parent_id": user_request.parent_id or creator_id,
                "organization_id": creator.get("organization_id") if creator else None,
                "roles": [user_request.role.value],  # Legacy compatibility
                "groups": [],
                "metadata": user_request.metadata,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "last_login": None
            }
            
            await self.db.users.insert_one(user_doc)
            print(f"DEBUG: Inserted user into database: {keycloak_user_id}")
            
            # Update hierarchy for the new user
            await self._update_user_hierarchy(keycloak_user_id)
            print(f"DEBUG: Updated hierarchy for user: {keycloak_user_id}")
            
            # Update hierarchy for the parent (to include the new child)
            if user_doc.get("parent_id"):
                await self._update_user_hierarchy(user_doc["parent_id"])
                print(f"DEBUG: Updated hierarchy for parent: {user_doc['parent_id']}")
            
            return {"user_id": keycloak_user_id, "message": "User created successfully"}
            
        except Exception as e:
            # Cleanup on failure
            try:
                if 'keycloak_user_id' in locals():
                    await self.keycloak.delete_keycloak_user(keycloak_user_id)
            except:
                pass
            raise e

    async def ensure_user_in_db(self, user: User) -> Dict[str, Any]:
        """Ensure a minimal user record exists in MongoDB for a Keycloak user."""
        existing = await self.get_user(user.user_id)
        if existing:
            return existing
        now = datetime.utcnow().isoformat()
        doc = {
            "user_id": user.user_id,
            "sub": user.sub,
            "username": user.username,
            "email": user.email,
            "name": user.name,
            "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
            "status": UserStatus.ACTIVE.value,
            "created_by": None,
            "parent_id": getattr(user, 'parent_id', None),
            "organization_id": getattr(user, 'organization_id', None),
            "roles": getattr(user, 'roles', [str(user.role)]),
            "groups": getattr(user, 'groups', []),
            "metadata": getattr(user, 'metadata', {}),
            "created_at": now,
            "updated_at": now,
            "last_login": now,
        }
        await self.db.users.insert_one(doc)
        await self._update_user_hierarchy(user.user_id)
        return doc

    async def ensure_admin_bootstrap(self, user: User) -> None:
        """If the logging-in user is admin, ensure they exist and hierarchies are built."""
        try:
            role = user.role if isinstance(user.role, UserRole) else UserRole(str(user.role))
        except Exception:
            role = UserRole.ADMIN if str(getattr(user, 'role', 'admin')) == 'admin' else UserRole.STUDENT
        if role != UserRole.ADMIN:
            return
        # Ensure admin user exists
        await self.ensure_user_in_db(user)
        # If admin has no hierarchy record, rebuild all
        hierarchy = await self.db.user_hierarchies.find_one({"user_id": user.user_id})
        if not hierarchy:
            await self.rebuild_all_hierarchies()
    
    async def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        return await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    async def get_users_under_manager(self, manager_id: str, include_indirect: bool = True) -> List[Dict[str, Any]]:
        """Get all users under a manager in hierarchy"""
        print(f"DEBUG: Getting users under manager: {manager_id}, include_indirect: {include_indirect}")
        
        if include_indirect:
            # Compute descendants purely from users collection (and class assignments for teachers)
            seen: set[str] = set()
            queue: List[str] = []
            # seed with direct children
            cur = self.db.users.find({"parent_id": manager_id}, {"user_id": 1, "role": 1, "_id": 0})
            first = [u async for u in cur]
            for u in first:
                uid = u.get("user_id")
                if uid:
                    seen.add(uid)
                    queue.append(uid)
            # BFS over parent links
            while queue:
                current = queue.pop(0)
                cur2 = self.db.users.find({"parent_id": current}, {"user_id": 1, "_id": 0})
                for u in [uu async for uu in cur2]:
                    uid = u.get("user_id")
                    if uid and uid not in seen:
                        seen.add(uid)
                        queue.append(uid)
            # Include students assigned to any teacher in the discovered set
            if seen:
                teacher_ids = [t for t in list(seen) if (await self.get_user(t) or {}).get("role") == UserRole.TEACHER.value]
                if teacher_ids:
                    curc = self.db.class_assignments.find({"teacher_id": {"$in": teacher_ids}}, {"students": 1, "_id": 0})
                    classes = [c async for c in curc]
                    for c in classes:
                        for sid in c.get("students", []) or []:
                            if sid and sid not in seen:
                                seen.add(sid)

            if not seen:
                print(f"DEBUG: No indirect or direct users found for {manager_id}")
                return []

            cursor = self.db.users.find({"user_id": {"$in": list(seen)}}, {"_id": 0})
            users = await cursor.to_list(length=None)
            print(f"DEBUG: Returning {len(users)} users under {manager_id}")
            return users
        else:
            # Only direct reports
            cursor = self.db.users.find({"parent_id": manager_id}, {"_id": 0})
            users = await cursor.to_list(length=None)
            print(f"DEBUG: Found {len(users)} direct reports")
            return users
    
    async def get_user_classes(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all classes for a user (as teacher or supervisor)"""
        user = await self.get_user(user_id)
        if not user:
            return []
        
        role = UserRole(user["role"])
        
        if role == UserRole.TEACHER:
            # Get classes where user is the teacher
            cursor = self.db.class_assignments.find({"teacher_id": user_id}, {"_id": 0})
        elif role == UserRole.SUPERVISOR:
            # Get classes managed by supervisor
            cursor = self.db.class_assignments.find({"supervisor_id": user_id}, {"_id": 0})
        elif role == UserRole.ADMIN:
            # Admin should see classes across their hierarchy (teachers/supervisors under them)
            # Collect descendant user IDs
            descendant_ids: List[str] = []
            queue: List[str] = []
            cur = self.db.users.find({"parent_id": user_id}, {"user_id": 1, "_id": 0})
            first = [u async for u in cur]
            for u in first:
                uid = u.get("user_id")
                if uid:
                    descendant_ids.append(uid)
                    queue.append(uid)
            while queue:
                current = queue.pop(0)
                cur2 = self.db.users.find({"parent_id": current}, {"user_id": 1, "_id": 0})
                for u in [uu async for uu in cur2]:
                    uid = u.get("user_id")
                    if uid and uid not in descendant_ids:
                        descendant_ids.append(uid)
                        queue.append(uid)
            # Find classes where teacher or supervisor is in descendant set
            query = {"$or": [
                {"teacher_id": {"$in": descendant_ids}},
                {"supervisor_id": {"$in": descendant_ids}},
            ]}
            cursor = self.db.class_assignments.find(query, {"_id": 0})
        else:
            return []
        
        classes = await cursor.to_list(length=None)
        
        # Enrich classes with teacher information
        enriched_classes = []
        for class_item in classes:
            teacher = await self.get_user(class_item["teacher_id"])
            if teacher:
                class_item["teacher_name"] = teacher["name"]
                class_item["teacher_email"] = teacher["email"]
            else:
                class_item["teacher_name"] = "Unknown"
                class_item["teacher_email"] = "Unknown"
            enriched_classes.append(class_item)
        
        return enriched_classes
    
    async def get_teacher_classes(self, teacher_id: str) -> List[Dict[str, Any]]:
        """Get classes assigned to a specific teacher"""
        cursor = self.db.class_assignments.find({"teacher_id": teacher_id}, {"_id": 0})
        classes = await cursor.to_list(length=None)
        
        # Enrich classes with teacher information
        enriched_classes = []
        for class_item in classes:
            teacher = await self.get_user(class_item["teacher_id"])
            if teacher:
                class_item["teacher_name"] = teacher["name"]
                class_item["teacher_email"] = teacher["email"]
            else:
                class_item["teacher_name"] = "Unknown"
                class_item["teacher_email"] = "Unknown"
            enriched_classes.append(class_item)
        
        return enriched_classes
    
    async def get_student_assignments(self, student_id: str) -> Dict[str, Any]:
        """Get class and teacher assignments for a student"""
        # Find class assignments that include this student
        cursor = self.db.class_assignments.find({"students": student_id}, {"_id": 0})
        classes = await cursor.to_list(length=None)
        
        if not classes:
            return {"classes": [], "teachers": []}
        
        # Get teacher information for each class
        teachers = []
        for class_assignment in classes:
            teacher = await self.get_user(class_assignment["teacher_id"])
            if teacher:
                teachers.append({
                    "teacher_id": teacher["user_id"],
                    "teacher_name": teacher["name"],
                    "class_id": class_assignment["class_id"],
                    "class_name": class_assignment["class_name"]
                })
        
        return {
            "classes": classes,
            "teachers": teachers
        }
    
    async def update_user_status(self, manager_id: str, user_id: str, status: UserStatus) -> bool:
        """Update user status with hierarchy validation"""
        manager = await self.get_user(manager_id)
        target_user = await self.get_user(user_id)
        
        if not manager or not target_user:
            return False
        
        manager_role = UserRole(manager["role"])
        target_role = UserRole(target_user["role"])
        
        if not self.can_manage_user(manager_role, target_role):
            raise ValueError("Insufficient permissions to manage this user")
        
        result = await self.db.users.update_one(
            {"user_id": user_id},
            {"$set": {"status": status.value, "updated_at": datetime.utcnow().isoformat()}}
        )
        
        return result.modified_count > 0
    
    # ========== Class Management ==========
    
    async def create_class_assignment(self, creator_id: str, class_name: str, teacher_id: str) -> str:
        """Create new class assignment"""
        creator = await self.get_user(creator_id)
        teacher = await self.get_user(teacher_id)
        
        if not creator or not teacher:
            raise ValueError("Creator or teacher not found")
        
        creator_role = UserRole(creator["role"])
        teacher_role = UserRole(teacher["role"])
        
        # Only supervisors and admins can create classes
        if creator_role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
            raise ValueError("Only supervisors and admins can create classes")
        
        # Teacher must be a teacher role
        if teacher_role != UserRole.TEACHER:
            raise ValueError("Assigned user must be a teacher")
        
        class_id = str(uuid.uuid4())
        class_doc = {
            "class_id": class_id,
            "class_name": class_name,
            "teacher_id": teacher_id,
            "students": [],
            "supervisor_id": creator_id if creator_role == UserRole.SUPERVISOR else None,
            "created_by": creator_id,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": {}
        }
        
        await self.db.class_assignments.insert_one(class_doc)
        return class_id
    
    async def assign_student_to_class(self, manager_id: str, student_id: str, class_id: str) -> bool:
        """Assign student to class"""
        manager = await self.get_user(manager_id)
        student = await self.get_user(student_id)
        class_assignment = await self.db.class_assignments.find_one({"class_id": class_id})
        
        if not manager or not student or not class_assignment:
            return False
        
        manager_role = UserRole(manager["role"])
        student_role = UserRole(student["role"])
        
        # Only supervisors and admins can assign students
        if manager_role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
            raise ValueError("Only supervisors and admins can assign students")
        
        # Student must be a student role
        if student_role != UserRole.STUDENT:
            raise ValueError("User must be a student")
        
        # Add student to class
        result = await self.db.class_assignments.update_one(
            {"class_id": class_id},
            {"$addToSet": {"students": student_id}}
        )
        
        if result.modified_count > 0:
            # Update teacher's hierarchy to include the student
            teacher_id = class_assignment["teacher_id"]
            print(f"DEBUG: Student {student_id} assigned to class {class_id}, updating teacher {teacher_id} hierarchy")
            await self._update_user_hierarchy(teacher_id)
            print(f"DEBUG: Teacher hierarchy updated after assigning student {student_id} to class {class_id}")
        
        return result.modified_count > 0
    
    async def unassign_student_from_class(self, manager_id: str, student_id: str, class_id: str) -> bool:
        """Unassign student from class"""
        manager = await self.get_user(manager_id)
        student = await self.get_user(student_id)
        class_assignment = await self.db.class_assignments.find_one({"class_id": class_id})
        
        if not manager or not student or not class_assignment:
            return False
        
        manager_role = UserRole(manager["role"])
        student_role = UserRole(student["role"])
        
        # Only supervisors and admins can unassign students
        if manager_role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
            raise ValueError("Only supervisors and admins can unassign students")
        
        # Student must be a student role
        if student_role != UserRole.STUDENT:
            raise ValueError("User must be a student")
        
        # Remove student from class
        result = await self.db.class_assignments.update_one(
            {"class_id": class_id},
            {"$pull": {"students": student_id}}
        )
        
        if result.modified_count > 0:
            # Update teacher's hierarchy after removing the student
            teacher_id = class_assignment["teacher_id"]
            print(f"DEBUG: Student {student_id} unassigned from class {class_id}, updating teacher {teacher_id} hierarchy")
            await self._update_user_hierarchy(teacher_id)
            print(f"DEBUG: Teacher hierarchy updated after unassigning student {student_id} from class {class_id}")
        
        return result.modified_count > 0
    
    async def delete_class(self, manager_id: str, class_id: str) -> bool:
        """Delete a class assignment"""
        manager = await self.get_user(manager_id)
        class_assignment = await self.db.class_assignments.find_one({"class_id": class_id})
        
        if not manager or not class_assignment:
            return False
        
        manager_role = UserRole(manager["role"])
        
        # Only supervisors and admins can delete classes
        if manager_role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
            raise ValueError("Only supervisors and admins can delete classes")
        
        # Check if manager has permission to delete this class
        if manager_role == UserRole.SUPERVISOR and class_assignment.get("supervisor_id") != manager_id:
            raise ValueError("Supervisors can only delete classes they created")
        
        # Get teacher ID before deleting
        teacher_id = class_assignment["teacher_id"]
        
        # Delete the class
        result = await self.db.class_assignments.delete_one({"class_id": class_id})
        
        if result.deleted_count > 0:
            # Update teacher's hierarchy after deleting the class
            await self._update_user_hierarchy(teacher_id)
            print(f"DEBUG: Updated teacher hierarchy after deleting class {class_id}")
        
        return result.deleted_count > 0
    
    async def get_teacher_students(self, teacher_id: str) -> List[Dict[str, Any]]:
        """Get all students assigned to a teacher"""
        # Find all classes where this teacher is assigned
        cursor = self.db.class_assignments.find({"teacher_id": teacher_id})
        classes = await cursor.to_list(length=None)
        
        # Collect all student IDs
        student_ids = []
        for class_assignment in classes:
            student_ids.extend(class_assignment.get("students", []))
        
        # Remove duplicates
        student_ids = list(set(student_ids))
        
        if student_ids:
            cursor = self.db.users.find({"user_id": {"$in": student_ids}}, {"_id": 0})
            return await cursor.to_list(length=None)
        
        return []
    
    async def get_student_teachers(self, student_id: str) -> List[Dict[str, Any]]:
        """Get all teachers assigned to a student"""
        # Find all classes where this student is assigned
        cursor = self.db.class_assignments.find({"students": student_id})
        classes = await cursor.to_list(length=None)
        
        # Collect teacher IDs
        teacher_ids = [class_assignment["teacher_id"] for class_assignment in classes]
        teacher_ids = list(set(teacher_ids))  # Remove duplicates
        
        if teacher_ids:
            cursor = self.db.users.find({"user_id": {"$in": teacher_ids}}, {"_id": 0})
            return await cursor.to_list(length=None)
        
        return []
    
    # ========== Hierarchy Management ==========
    
    async def _update_user_hierarchy(self, user_id: str):
        """Update user hierarchy information"""
        print(f"DEBUG: Updating hierarchy for user: {user_id}")
        user = await self.get_user(user_id)
        if not user:
            print(f"DEBUG: User {user_id} not found, cannot update hierarchy")
            return
        
        role = UserRole(user["role"])
        level = self.get_role_level(role)
        
        # Build path from root
        path = []
        current_parent = user.get("parent_id")
        
        while current_parent:
            parent = await self.get_user(current_parent)
            if not parent:
                break
            path.insert(0, current_parent)
            current_parent = parent.get("parent_id")
        
        # Compute all descendants via BFS on users.parent_id
        descendant_ids: List[str] = []
        queue: List[str] = []
        cursor = self.db.users.find({"parent_id": user_id}, {"user_id": 1, "_id": 0})
        direct_children = [c.get("user_id") for c in await cursor.to_list(length=None) if c.get("user_id")]
        queue.extend(direct_children)
        while queue:
            current = queue.pop(0)
            descendant_ids.append(current)
            cur_cursor = self.db.users.find({"parent_id": current}, {"user_id": 1, "_id": 0})
            next_children = [c.get("user_id") for c in await cur_cursor.to_list(length=None) if c.get("user_id")]
            queue.extend(next_children)

        # For teachers, also include students assigned to their classes
        if role == UserRole.TEACHER:
            cursor = self.db.class_assignments.find({"teacher_id": user_id})
            classes = await cursor.to_list(length=None)
            for class_assignment in classes:
                student_ids = class_assignment.get("students", [])
                descendant_ids.extend(student_ids)
            descendant_ids = list(set(descendant_ids))
            print(f"DEBUG: Teacher {user_id} has {len(classes)} classes with students")
        
        print(f"DEBUG: Found {len(descendant_ids)} descendants for user {user_id}: {descendant_ids}")
        
        # Update hierarchy record
        hierarchy_doc = {
            "user_id": user_id,
            "parent_id": user.get("parent_id"),
            "role": role.value,
            "level": level,
            "path": path,
            "children": descendant_ids
        }
        
        await self.db.user_hierarchies.replace_one(
            {"user_id": user_id},
            hierarchy_doc,
            upsert=True
        )
        print(f"DEBUG: Updated hierarchy document for user {user_id}: {hierarchy_doc}")
    
    async def rebuild_all_hierarchies(self):
        """Rebuild all user hierarchies (maintenance function)"""
        cursor = self.db.users.find({})
        async for user in cursor:
            await self._update_user_hierarchy(user["user_id"])
    
    # ========== Document Access Control ==========
    
    async def can_access_document(self, user_id: str, document: Dict[str, Any]) -> bool:
        """Check if user can access document based on hierarchy and access level"""
        # Document owner can always access
        if document.get("user_id") == user_id:
            return True
        
        access_level = document.get("access_level", "private")
        
        if access_level == "private":
            # Check if user is specifically granted access
            return user_id in document.get("accessible_to", [])
        
        elif access_level == "hierarchy":
            # Check if user is under document owner in hierarchy
            doc_owner_hierarchy = await self.db.user_hierarchies.find_one({"user_id": document["user_id"]})
            if not doc_owner_hierarchy:
                return False
            
            # User can access if they are in the hierarchy under the document owner
            user_hierarchy = await self.db.user_hierarchies.find_one({"user_id": user_id})
            if not user_hierarchy:
                return False
            
            # Check if document owner is in user's path (user is under doc owner)
            return document["user_id"] in user_hierarchy.get("path", [])
        
        elif access_level == "public":
            # Check if in same organization
            user = await self.get_user(user_id)
            if not user:
                return False
            
            return user.get("organization_id") == document.get("organization_id")
        
        return False
    
    async def get_accessible_documents(self, user_id: str) -> List[str]:
        """Get list of document IDs accessible to user"""
        accessible_docs = []
        
        # This would typically be implemented in the document service
        # For now, return empty list as placeholder
        return accessible_docs


# Global service instance
user_management_service: Optional[UserManagementService] = None


def get_user_management_service() -> UserManagementService:
    """Get global user management service instance"""
    global user_management_service
    if user_management_service is None:
        try:
            user_management_service = UserManagementService(
                settings.mongodb_uri,
                settings.mongodb_db_name
            )
            print("DEBUG: User management service initialized successfully")
        except Exception as e:
            print(f"DEBUG: Failed to initialize user management service: {e}")
            raise
    return user_management_service
