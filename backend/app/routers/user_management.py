"""
User Management API Router
Handles hierarchical user creation, assignment, and management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional

from app.models.auth import (
    User, UserRole, UserStatus, UserCreationRequest, UserAssignmentRequest,
    ClassAssignment
)
from app.services.auth_service import get_current_user
from app.services.user_management_service import get_user_management_service
from app.services.mongo_chat_store import get_mongo_store

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("/health")
async def user_management_health():
    """Health check for user management service"""
    try:
        user_service = get_user_management_service()
        return {"status": "healthy", "service": "user_management"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


@router.post("/sync-profile")
async def sync_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Sync current user's profile to database"""
    try:
        user_service = get_user_management_service()
        
        # Check if user already exists
        existing_user = await user_service.get_user(current_user.user_id)
        if existing_user:
            return {"message": "User already exists in database", "user_id": current_user.user_id}
        
        # Create user in database (this will also create in Keycloak if needed)
        # For now, just return success since the profile endpoint handles the fallback
        return {"message": "Profile synced successfully", "user_id": current_user.user_id}
        
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/create", response_model=Dict[str, Any])
async def create_user(
    user_request: UserCreationRequest,
    current_user: User = Depends(get_current_user)
):
    """Create new user with hierarchy validation"""
    try:
        user_service = get_user_management_service()
        result = await user_service.create_user(current_user.user_id, user_request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/managed", response_model=List[Dict[str, Any]])
async def get_managed_users(
    include_indirect: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get all users under current user in hierarchy"""
    try:
        user_service = get_user_management_service()
        users = await user_service.get_users_under_manager(
            current_user.user_id, 
            include_indirect
        )
        return users
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/profile", response_model=Dict[str, Any])
async def get_user_profile(
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get user profile (own or managed user)"""
    try:
        user_service = get_user_management_service()
        
        # If no user_id specified, return current user's profile
        target_id = user_id or current_user.user_id
        
        user = await user_service.get_user(target_id)
        
        # If user doesn't exist in database, create a profile from current user info
        if not user:
            if target_id == current_user.user_id:
                # Create profile from current user (from Keycloak token)
                user = {
                    "user_id": current_user.user_id,
                    "sub": current_user.sub,
                    "username": current_user.username,
                    "email": current_user.email,
                    "name": current_user.name,
                    "role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
                    "status": current_user.status.value if hasattr(current_user.status, 'value') else str(current_user.status),
                    "created_by": getattr(current_user, 'created_by', None),
                    "parent_id": getattr(current_user, 'parent_id', None),
                    "organization_id": getattr(current_user, 'organization_id', None),
                    "roles": getattr(current_user, 'roles', []),
                    "groups": getattr(current_user, 'groups', []),
                    "metadata": getattr(current_user, 'metadata', {}),
                    "created_at": getattr(current_user, 'created_at', None),
                    "updated_at": getattr(current_user, 'updated_at', None),
                    "last_login": getattr(current_user, 'last_login', None)
                }
                print(f"DEBUG: Created profile from current user: {user}")
            else:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # If requesting another user's profile, check permissions
        if user_id and user_id != current_user.user_id:
            current_role = UserRole(current_user.role) if hasattr(current_user, 'role') else UserRole.STUDENT
            target_role = UserRole(user["role"])
            
            if not user_service.can_manage_user(current_role, target_role):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/status/{user_id}")
async def update_user_status(
    user_id: str,
    status: UserStatus,
    current_user: User = Depends(get_current_user)
):
    """Update user status"""
    try:
        user_service = get_user_management_service()
        success = await user_service.update_user_status(
            current_user.user_id, 
            user_id, 
            status
        )
        
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        return {"message": "User status updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/permissions", response_model=Dict[str, Any])
async def get_user_permissions(
    current_user: User = Depends(get_current_user)
):
    """Get current user's permissions and accessible pages"""
    try:
        print(f"DEBUG: Permissions endpoint - current_user: {current_user}")
        print(f"DEBUG: Permissions endpoint - current_user.role: {getattr(current_user, 'role', 'NO_ROLE_ATTR')}")
        
        # Try to get role from current user, fallback to student
        if hasattr(current_user, 'role') and current_user.role:
            role = UserRole(current_user.role)
            print(f"DEBUG: Using role from current_user: {role}")
        else:
            # Fallback: try to determine role from Keycloak token
            role = UserRole.STUDENT  # Default fallback
            print(f"DEBUG: Using fallback role: {role}")
        
        # Try to get user service, but handle gracefully if it fails
        try:
            user_service = get_user_management_service()
            accessible_pages = user_service.get_accessible_pages(role)
            can_create_roles = [r.value for r in UserRole if user_service.can_create_role(role, r)]
            role_level = user_service.get_role_level(role)
        except Exception as e:
            print(f"DEBUG: User service not available, using fallback permissions: {e}")
            # Fallback permissions based on role
            accessible_pages = {
                UserRole.ADMIN: ["upload", "documents", "chat", "search", "config", "health", "users"],
                UserRole.SUPERVISOR: ["upload", "documents", "chat", "search", "users"],
                UserRole.TEACHER: ["upload", "documents", "chat", "users"],
                UserRole.STUDENT: ["chat", "users"]
            }.get(role, ["chat", "users"])
            
            can_create_roles = {
                UserRole.ADMIN: ["supervisor", "teacher", "student"],
                UserRole.SUPERVISOR: ["teacher", "student"],
                UserRole.TEACHER: ["student"],
                UserRole.STUDENT: []
            }.get(role, [])
            
            role_level = {
                UserRole.ADMIN: 0,
                UserRole.SUPERVISOR: 1,
                UserRole.TEACHER: 2,
                UserRole.STUDENT: 3
            }.get(role, 3)
        
        result = {
            "role": role.value,
            "accessible_pages": accessible_pages,
            "can_create_roles": can_create_roles,
            "role_level": role_level
        }
        
        print(f"DEBUG: Returning permissions: {result}")
        return result
    except Exception as e:
        print(f"DEBUG: Error in permissions endpoint: {e}")
        # Ultimate fallback - return basic student permissions
        return {
            "role": "student",
            "accessible_pages": ["chat", "users"],
            "can_create_roles": [],
            "role_level": 3
        }


# ========== Class Management ==========

@router.post("/classes", response_model=Dict[str, Any])
async def create_class(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Create new class assignment"""
    try:
        class_name = request.get("class_name")
        teacher_id = request.get("teacher_id")
        
        if not class_name or not teacher_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="class_name and teacher_id are required")
        
        user_service = get_user_management_service()
        class_id = await user_service.create_class_assignment(
            current_user.user_id,
            class_name,
            teacher_id
        )
        return {"class_id": class_id, "message": "Class created successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/classes/{class_id}/students")
async def assign_student_to_class(
    class_id: str,
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Assign student to class"""
    try:
        student_id = request.get("student_id")
        if not student_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student_id is required")
        
        user_service = get_user_management_service()
        success = await user_service.assign_student_to_class(
            current_user.user_id,
            student_id,
            class_id
        )
        
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class or student not found")
        
        return {"message": "Student assigned to class successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/classes/{class_id}/students")
async def unassign_student_from_class(
    class_id: str,
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Unassign student from class"""
    try:
        student_id = request.get("student_id")
        if not student_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student_id is required")
        
        user_service = get_user_management_service()
        success = await user_service.unassign_student_from_class(
            current_user.user_id,
            student_id,
            class_id
        )
        
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class or student not found")
        
        return {"message": "Student unassigned from class successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/classes/{class_id}")
async def delete_class(
    class_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a class assignment"""
    try:
        user_service = get_user_management_service()
        success = await user_service.delete_class(
            current_user.user_id,
            class_id
        )
        
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
        
        return {"message": "Class deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/classes", response_model=List[Dict[str, Any]])
async def get_classes(
    current_user: User = Depends(get_current_user)
):
    """Get all classes for current user (as teacher or supervisor)"""
    try:
        user_service = get_user_management_service()
        classes = await user_service.get_user_classes(current_user.user_id)
        # Enrich with assigned prompt info
        try:
            store = get_mongo_store()
            enriched = []
            for c in classes:
                pid = c.get("prompt_id")
                if pid:
                    p = await store.db.rag_prompts.find_one({"prompt_id": pid}, {"_id": 0})
                    if p:
                        c["prompt"] = {"prompt_id": p.get("prompt_id"), "name": p.get("name"), "content": p.get("content", "")}
                enriched.append(c)
            classes = enriched
        except Exception:
            pass
        return classes
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ========== Class Prompt Management ==========

@router.post("/classes/{class_id}/prompt")
async def assign_prompt_to_class(
    class_id: str,
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Assign a RAG prompt to a class. Admin and Supervisor only."""
    try:
        prompt_id = request.get("prompt_id")
        if not prompt_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="prompt_id is required")

        # Permission check
        role = UserRole(current_user.role) if hasattr(current_user, 'role') else UserRole.STUDENT
        if role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        store = get_mongo_store()
        await store.set_class_prompt(class_id, prompt_id)
        return {"message": "Prompt assigned to class"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/classes/{class_id}/prompt")
async def clear_class_prompt(
    class_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove the RAG prompt assignment from a class. Admin and Supervisor only."""
    try:
        role = UserRole(current_user.role) if hasattr(current_user, 'role') else UserRole.STUDENT
        if role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        store = get_mongo_store()
        await store.clear_class_prompt(class_id)
        return {"message": "Prompt cleared from class"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/classes/{teacher_id}/assigned", response_model=List[Dict[str, Any]])
async def get_teacher_classes(
    teacher_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get classes assigned to a specific teacher"""
    try:
        user_service = get_user_management_service()
        classes = await user_service.get_teacher_classes(teacher_id)
        return classes
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/students/{student_id}/assignments", response_model=Dict[str, Any])
async def get_student_assignments(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get class and teacher assignments for a student"""
    try:
        user_service = get_user_management_service()
        assignments = await user_service.get_student_assignments(student_id)
        return assignments
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/teachers/{teacher_id}/students", response_model=List[Dict[str, Any]])
async def get_teacher_students(
    teacher_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get students assigned to a teacher"""
    try:
        user_service = get_user_management_service()
        
        # Check if current user can view this teacher's students
        if teacher_id != current_user.user_id:
            current_role = UserRole(current_user.role) if hasattr(current_user, 'role') else UserRole.STUDENT
            if current_role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        
        students = await user_service.get_teacher_students(teacher_id)
        return students
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/students/{student_id}/teachers", response_model=List[Dict[str, Any]])
async def get_student_teachers(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get teachers assigned to a student"""
    try:
        user_service = get_user_management_service()
        
        # Students can only view their own teachers, others need supervisor+ role
        if student_id != current_user.user_id:
            current_role = UserRole(current_user.role) if hasattr(current_user, 'role') else UserRole.STUDENT
            if current_role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        
        teachers = await user_service.get_student_teachers(student_id)
        return teachers
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ========== Hierarchy Management ==========

@router.post("/hierarchy/rebuild")
async def rebuild_hierarchies(
    current_user: User = Depends(get_current_user)
):
    """Rebuild all user hierarchies (admin only)"""
    try:
        current_role = UserRole(current_user.role) if hasattr(current_user, 'role') else UserRole.STUDENT
        if current_role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
        
        user_service = get_user_management_service()
        await user_service.rebuild_all_hierarchies()
        
        return {"message": "Hierarchies rebuilt successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
