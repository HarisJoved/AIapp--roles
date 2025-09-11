from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime


class UserRole(str, Enum):
    """Hierarchical user roles"""
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    TEACHER = "teacher"
    STUDENT = "student"


class UserStatus(str, Enum):
    """User status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class User(BaseModel):
    """User model for authentication and hierarchy"""
    sub: str = Field(..., description="Subject identifier (user ID)")
    user_id: str = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    username: str = Field(..., description="Username")
    name: str = Field(..., description="Full name")
    role: UserRole = Field(..., description="Primary role in hierarchy")
    status: UserStatus = Field(default=UserStatus.ACTIVE, description="User status")
    
    # Hierarchy relationships
    created_by: Optional[str] = Field(None, description="ID of user who created this user")
    parent_id: Optional[str] = Field(None, description="Direct parent in hierarchy")
    organization_id: Optional[str] = Field(None, description="Organization/school ID")
    
    # Additional metadata
    roles: List[str] = Field(default_factory=list, description="Legacy roles for compatibility")
    groups: List[str] = Field(default_factory=list, description="User groups")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional user metadata")
    
    # Timestamps
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")


class UserHierarchy(BaseModel):
    """User hierarchy relationship model"""
    user_id: str = Field(..., description="User ID")
    parent_id: Optional[str] = Field(None, description="Parent user ID")
    role: UserRole = Field(..., description="User role")
    level: int = Field(..., description="Hierarchy level (0=admin, 1=supervisor, etc.)")
    path: List[str] = Field(default_factory=list, description="Full path from root")
    children: List[str] = Field(default_factory=list, description="Direct children user IDs")


class ClassAssignment(BaseModel):
    """Class assignment model for teacher-student relationships"""
    class_id: str = Field(..., description="Class identifier")
    class_name: str = Field(..., description="Class name")
    teacher_id: str = Field(..., description="Teacher user ID")
    students: List[str] = Field(default_factory=list, description="Student user IDs")
    supervisor_id: str = Field(..., description="Supervisor who manages this class")
    created_by: str = Field(..., description="User who created this assignment")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional class metadata")


class UserCreationRequest(BaseModel):
    """Request model for creating new users"""
    username: str = Field(..., description="Username")
    email: str = Field(..., description="Email address")
    name: str = Field(..., description="Full name")
    role: UserRole = Field(..., description="User role")
    password: str = Field(..., description="Initial password")
    parent_id: Optional[str] = Field(None, description="Parent user ID in hierarchy")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class UserAssignmentRequest(BaseModel):
    """Request model for user assignments"""
    user_id: str = Field(..., description="User to assign")
    target_id: str = Field(..., description="Target user/class to assign to")
    assignment_type: str = Field(..., description="Type of assignment (class, supervisor, etc.)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Assignment metadata")


class TokenData(BaseModel):
    """Token data model"""
    sub: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    groups: List[str] = Field(default_factory=list)
