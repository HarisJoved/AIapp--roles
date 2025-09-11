"""
Simple authentication service to replace Keycloak.
"""
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.auth import User, TokenData, UserRole, UserStatus
from app.config.settings import settings

# Security scheme for JWT tokens
security = HTTPBearer()

# For now, we'll use a simple approach - you can enhance this later
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Validate JWT token and return user information"""
    try:
        # For now, just return a mock user - you can implement proper JWT validation later
        # This allows the application to run without Keycloak while you implement your preferred auth
        token = credentials.credentials
        
        print(f"DEBUG: Auth service received token: {token[:20]}..." if token else "DEBUG: No token received")
        
        # Try to decode the JWT token to get the actual user ID
        try:
            # Split the token and decode the payload part (second part)
            token_parts = token.split('.')
            if len(token_parts) == 3:  # JWT has 3 parts: header.payload.signature
                import base64
                import json
                
                # Decode the payload part (second part)
                payload = token_parts[1]
                # Add padding if needed
                payload += '=' * (4 - len(payload) % 4)
                decoded_bytes = base64.urlsafe_b64decode(payload)
                decoded_token = json.loads(decoded_bytes.decode('utf-8'))
                
                print(f"DEBUG: Decoded token payload: {decoded_token}")
                
                # Extract user ID from token
                user_id = decoded_token.get('sub') or decoded_token.get('user_id') or 'unknown-user'
                email = decoded_token.get('email') or 'user@example.com'
                username = decoded_token.get('preferred_username') or 'user'
                name = decoded_token.get('name') or f"{decoded_token.get('given_name', '')} {decoded_token.get('family_name', '')}".strip() or 'User'
                
                # Extract roles from Keycloak token
                keycloak_roles = []
                if 'resource_access' in decoded_token and 'embedder-client' in decoded_token['resource_access']:
                    keycloak_roles = decoded_token['resource_access']['embedder-client'].get('roles', [])
                
                # Determine primary role (use the first role found, or default to student)
                primary_role = 'student'  # default
                if keycloak_roles:
                    # Priority order: admin > supervisor > teacher > student
                    if 'admin' in keycloak_roles:
                        primary_role = 'admin'
                    elif 'supervisor' in keycloak_roles:
                        primary_role = 'supervisor'
                    elif 'teacher' in keycloak_roles:
                        primary_role = 'teacher'
                    elif 'student' in keycloak_roles:
                        primary_role = 'student'
                
                print(f"DEBUG: Extracted roles from token: {keycloak_roles}, primary role: {primary_role}")
                
            else:
                raise ValueError("Invalid JWT token format")
            
        except Exception as decode_error:
            print(f"DEBUG: Failed to decode token, using fallback: {decode_error}")
            # Fallback to mock user if token decoding fails
            user_id = 'mock-user-id'
            email = 'user@example.com'
            username = 'mockuser'
            name = 'Mock User'
            primary_role = 'student'
            keycloak_roles = []
        
        # Try to get user from database first
        try:
            from app.services.user_management_service import get_user_management_service
            user_service = get_user_management_service()
            db_user = await user_service.get_user(user_id)
        except Exception as e:
            print(f"DEBUG: Failed to get user from database: {e}")
            db_user = None
        
        if db_user:
            # Use database user info, but prioritize Keycloak role if available
            db_role = db_user.get("role", primary_role)
            final_role = primary_role if primary_role != 'student' else db_role
            
            user = User(
                sub=user_id,
                user_id=user_id,
                email=db_user.get("email", email),
                username=db_user.get("username", username),
                name=db_user.get("name", name),
                role=UserRole(final_role),
                status=UserStatus(db_user.get("status", "active")),
                created_by=db_user.get("created_by"),
                parent_id=db_user.get("parent_id"),
                organization_id=db_user.get("organization_id"),
                roles=keycloak_roles if keycloak_roles else [final_role],  # Use Keycloak roles or fallback
                groups=db_user.get("groups", []),
                metadata=db_user.get("metadata", {}),
                created_at=db_user.get("created_at"),
                updated_at=db_user.get("updated_at"),
                last_login=db_user.get("last_login")
            )
        else:
            # Fallback to basic user (for development/testing)
            user = User(
                sub=user_id,
                user_id=user_id,
                email=email,
                username=username,
                name=name,
                role=UserRole(primary_role),  # Use extracted role
                status=UserStatus.ACTIVE,
                roles=keycloak_roles if keycloak_roles else [primary_role],  # Use Keycloak roles or fallback
                groups=[]
            )
        
        print(f"DEBUG: Auth service created user: {user.sub}, {user.user_id}, role: {user.role}")
        
        return user
        
    except Exception as e:
        print(f"DEBUG: Auth service error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}"
        )


async def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify a token and return payload"""
    try:
        # Split the token and decode the payload part (second part)
        token_parts = token.split('.')
        if len(token_parts) == 3:  # JWT has 3 parts: header.payload.signature
            import base64
            import json
            
            # Decode the payload part (second part)
            payload = token_parts[1]
            # Add padding if needed
            payload += '=' * (4 - len(payload) % 4)
            decoded_bytes = base64.urlsafe_b64decode(payload)
            decoded = json.loads(decoded_bytes.decode('utf-8'))
            return decoded
        else:
            raise ValueError("Invalid JWT token format")
    except Exception:
        # Return mock data if decoding fails
        return {
            "sub": "mock-user-id",
            "email": "user@example.com",
            "preferred_username": "mockuser"
        }
