from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class User(BaseModel):
    """User model for authentication"""
    sub: str = Field(..., description="Subject identifier (user ID)")
    user_id: str = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    username: str = Field(..., description="Username")
    name: str = Field(..., description="Full name")
    roles: List[str] = Field(default_factory=list, description="User roles")
    groups: List[str] = Field(default_factory=list, description="User groups")


class TokenData(BaseModel):
    """Token data model"""
    sub: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    groups: List[str] = Field(default_factory=list)
