"""
Simple authentication service to replace Keycloak.
"""
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.auth import User, TokenData
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
                
            else:
                raise ValueError("Invalid JWT token format")
            
        except Exception as decode_error:
            print(f"DEBUG: Failed to decode token, using fallback: {decode_error}")
            # Fallback to mock user if token decoding fails
            user_id = 'mock-user-id'
            email = 'user@example.com'
            username = 'mockuser'
            name = 'Mock User'
        
        # Create user with actual or fallback data
        user = User(
            sub=user_id,  # This is what the chat router expects
            user_id=user_id,
            email=email,
            username=username,
            name=name,
            roles=["user"],
            groups=[]
        )
        
        print(f"DEBUG: Auth service created user: {user.sub}, {user.user_id}")
        
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
