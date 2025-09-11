# Hierarchical Role System Setup Guide

This document explains how to set up and use the new hierarchical role system in your Document Embedding Platform.

## Overview

The system now supports four hierarchical roles:
- **Admin**: Full access to all features and configuration
- **Supervisor**: Can manage teachers and students, no configuration access
- **Teacher**: Can upload documents and manage assigned students
- **Student**: Can only chat with accessible documents and view profile

## Setup Instructions

### 1. Backend Configuration

1. Copy the environment file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Configure Keycloak admin credentials in `.env`:
   ```env
   KEYCLOAK_ADMIN_USERNAME="your_keycloak_admin_username"
   KEYCLOAK_ADMIN_PASSWORD="your_keycloak_admin_password"
   ```

3. Ensure MongoDB is running and accessible.

### 2. Keycloak Role Setup

You need to create the following roles in your Keycloak client (`embedder-client`):

1. Go to Keycloak Admin Console
2. Navigate to your realm (`embedder`)
3. Go to Clients → `embedder-client` → Roles
4. Create these roles:
   - `admin`
   - `supervisor`
   - `teacher`
   - `student`

### 3. Create Initial Admin User

1. In Keycloak, create a user and assign the `admin` role
2. The admin can then use the application to create other users

### 4. Database Collections

The system will automatically create these MongoDB collections:
- `users` - User profiles and hierarchy information
- `user_hierarchies` - Hierarchy relationships
- `class_assignments` - Teacher-student class assignments
- `conversations` - Chat conversations (existing)
- `messages` - Chat messages (existing)
- `rag_prompts` - RAG prompts (existing)

## Usage Guide

### Admin Role

**Access**: All pages (Upload, Chat, Search, Documents, Users, Config, Health)

**Capabilities**:
- Configure embedders, vector databases, and chat models
- Create and manage all user types
- Access system health monitoring
- Set document access levels (private, hierarchy, public)
- View and manage all documents

**User Management**:
- Can create supervisors, teachers, and students
- Can assign users to hierarchy
- Can suspend/activate users
- Can create classes and assignments

### Supervisor Role

**Access**: Upload, Chat, Search, Documents, Users

**Capabilities**:
- Create and manage teachers and students
- Create classes and assign teachers
- Assign students to classes
- Upload documents with access control
- View documents accessible to them

**User Management**:
- Can create teachers and students under them
- Can assign classes to teachers
- Can assign students to classes
- Cannot access configuration

### Teacher Role

**Access**: Upload, Documents, Chat, Users

**Capabilities**:
- Upload documents with access control
- View assigned students
- Chat with accessible documents
- View own profile and student assignments

**User Management**:
- Can view assigned students
- Cannot create users
- Cannot access configuration or search

### Student Role

**Access**: Chat, Users

**Capabilities**:
- Chat with documents made accessible by teachers/supervisors/admins
- View own profile
- View assigned teachers

**Restrictions**:
- Cannot upload documents
- Cannot search documents directly
- Cannot access configuration
- Cannot manage users

## Document Access Control

### Access Levels

1. **Private**: Only the uploader can access
2. **Hierarchy**: Users under the uploader in the hierarchy can access
3. **Public**: All users in the same organization can access

### Access Rules

- **Students** can only access documents shared with them by hierarchy or public setting
- **Teachers** can share documents with their students via hierarchy setting
- **Supervisors** can share documents with teachers and students under them
- **Admins** can share documents with everyone via public setting

## API Endpoints

### User Management
- `POST /users/create` - Create new user
- `GET /users/managed` - Get users under current user
- `GET /users/profile` - Get user profile
- `PUT /users/status/{user_id}` - Update user status
- `GET /users/permissions` - Get current user permissions

### Class Management
- `POST /users/classes` - Create class
- `POST /users/classes/{class_id}/students` - Assign student to class
- `GET /users/teachers/{teacher_id}/students` - Get teacher's students
- `GET /users/students/{student_id}/teachers` - Get student's teachers

### Document Upload
- `POST /upload/` - Upload document with access level

## Troubleshooting

### Common Issues

1. **Users not appearing in hierarchy**
   - Run `POST /users/hierarchy/rebuild` as admin to rebuild hierarchies

2. **Permission denied errors**
   - Check user roles in Keycloak
   - Verify user is in correct hierarchy
   - Ensure parent-child relationships are set correctly

3. **Document access issues**
   - Check document access level
   - Verify user hierarchy relationships
   - Ensure organization_id is set correctly

### Database Queries

Check user hierarchy:
```javascript
db.user_hierarchies.find({user_id: "user_id_here"})
```

Check user relationships:
```javascript
db.users.find({parent_id: "parent_user_id"})
```

Check class assignments:
```javascript
db.class_assignments.find({teacher_id: "teacher_id_here"})
```

## Frontend Changes

### Navigation
- Navigation items are now role-based and dynamically shown
- Users only see pages they have access to

### User Management Page
- Admins and supervisors see user creation and management tools
- Teachers see only their assigned students
- Students see only their profile and assigned teachers

### Document Upload
- Access level selection based on user role
- Students cannot upload documents
- Teachers and above can set access levels

### Chat Interface
- Students only see documents shared with them
- Search functionality restricted based on role

## Security Considerations

1. **Role Validation**: All API endpoints validate user roles
2. **Hierarchy Enforcement**: Users can only manage users below them
3. **Document Access**: Strict access control based on hierarchy and settings
4. **Keycloak Integration**: User creation synced with Keycloak
5. **Token Validation**: All requests require valid JWT tokens

## Migration from Previous Version

If upgrading from a previous version:

1. Existing users will default to `student` role
2. Run the hierarchy rebuild endpoint to establish relationships
3. Assign appropriate roles in Keycloak
4. Update user records in MongoDB with correct role and hierarchy information

This hierarchical system provides fine-grained control over user access and document sharing while maintaining the existing functionality for document processing and chat capabilities.
