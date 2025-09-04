# Role-Based Access Control (RBAC) Implementation

## Overview

The Solicitor Brain v2 application now includes a comprehensive Role-Based Access Control (RBAC) system that provides:

- **Granular permission management** for all resources
- **Role-based access control** with inheritance
- **Dynamic permission checking** with resource ownership
- **Comprehensive audit logging** for all permission changes
- **UK legal compliance** features

## Architecture

### Database Schema

The RBAC system adds four new tables to the existing schema:

```sql
roles               -- Define system roles (admin, solicitor, paralegal, client)
permissions         -- Define granular permissions (resource:action format)
role_permissions    -- Junction table mapping roles to permissions
user_roles          -- Junction table mapping users to roles (with expiration)
```

### Core Components

1. **RBACService** (`/server/services/rbac.cjs`)
   - Core business logic for role and permission management
   - Permission checking and resource ownership validation
   - Audit logging for all RBAC operations

2. **RBACMiddleware** (`/server/middleware/rbac.cjs`)
   - Express middleware for route protection
   - Multiple middleware types for different use cases
   - JWT integration for user identification

3. **RBAC API Routes** (`/server/routes/rbac.cjs`)
   - RESTful endpoints for role and permission management
   - Admin-only access with comprehensive error handling
   - Audit logging for all management operations

## Default Roles and Permissions

### Roles

| Role | Description | User Count |
|------|-------------|------------|
| `admin` | Full system access, user management, audit logs | System administrators |
| `solicitor` | Case management, client management, document generation | Licensed solicitors |
| `paralegal` | Limited case access, document preparation, research | Support staff |
| `client` | Read-only access to their own cases | External clients |

### Permission Categories

| Category | Permissions | Description |
|----------|-------------|-------------|
| **System** | `system:admin`, `system:audit` | System-level operations |
| **Users** | `users:create`, `users:read`, `users:update`, `users:delete` | User management |
| **Cases** | `cases:create`, `cases:read`, `cases:update`, `cases:delete`, `cases:read_own` | Case management |
| **Documents** | `documents:create`, `documents:read`, `documents:update`, `documents:delete`, `documents:generate` | Document operations |
| **Clients** | `clients:create`, `clients:read`, `clients:update`, `clients:delete` | Client management |
| **AI** | `ai:chat`, `ai:research`, `ai:generate` | AI-powered features |
| **Compliance** | `compliance:check` | Compliance checking |
| **Audit** | `audit:read` | Audit log access |
| **Deadlines** | `deadlines:calculate` | Legal deadline calculation |
| **Workflow** | `workflow:manage` | Case workflow management |

### Role-Permission Matrix

| Permission | Admin | Solicitor | Paralegal | Client |
|------------|-------|-----------|-----------|--------|
| `system:admin` | ✅ | ❌ | ❌ | ❌ |
| `system:audit` | ✅ | ❌ | ❌ | ❌ |
| `users:*` | ✅ | `read` only | ❌ | ❌ |
| `cases:*` | ✅ | ✅ | `read`, `update` | `read_own` |
| `documents:*` | ✅ | ✅ | All except `delete` | `read` only |
| `clients:*` | ✅ | ✅ | `read`, `update` | ❌ |
| `ai:*` | ✅ | ✅ | ✅ | ❌ |
| `compliance:check` | ✅ | ✅ | ❌ | ❌ |
| `audit:read` | ✅ | ❌ | ❌ | ❌ |
| `deadlines:calculate` | ✅ | ✅ | ✅ | ❌ |
| `workflow:manage` | ✅ | ✅ | ❌ | ❌ |

## API Endpoints

### Role Management

```http
GET    /api/rbac/roles                           # List all roles
POST   /api/rbac/roles                           # Create new role
GET    /api/rbac/roles/:roleId/permissions       # Get role permissions
```

### Permission Management

```http
GET    /api/rbac/permissions                     # List all permissions
POST   /api/rbac/permissions                     # Create new permission
```

### Role-Permission Assignment

```http
POST   /api/rbac/roles/:roleId/permissions/:permissionId    # Assign permission to role
DELETE /api/rbac/roles/:roleId/permissions/:permissionId    # Remove permission from role
```

### User Role Management

```http
GET    /api/rbac/users/:userId/roles             # Get user roles
GET    /api/rbac/users/:userId/permissions       # Get user permissions
POST   /api/rbac/users/:userId/roles/:roleId     # Assign role to user
DELETE /api/rbac/users/:userId/roles/:roleId     # Remove role from user
```

### Permission Checking

```http
POST   /api/rbac/check-permission                # Check specific permission
POST   /api/rbac/check-access                    # Check resource access
```

### Audit and Reporting

```http
GET    /api/rbac/audit/permissions               # Permission check audit log
GET    /api/rbac/stats                           # RBAC system statistics
```

## Middleware Usage

### Basic Authentication

```javascript
// Require user to be logged in
app.get('/api/protected', rbacMiddleware.requireAuth(), handler);
```

### Role-Based Protection

```javascript
// Require specific role
app.get('/api/admin-only', rbacMiddleware.requireRole('admin'), handler);

// Require any of multiple roles
app.get('/api/staff-only', rbacMiddleware.requireAnyRole(['admin', 'solicitor']), handler);
```

### Permission-Based Protection

```javascript
// Require specific permission
app.post('/api/cases', rbacMiddleware.requirePermission('cases:create'), handler);

// Require resource-specific permission
app.get('/api/cases/:id', rbacMiddleware.requireResourcePermission('cases', 'read'), handler);
```

### Advanced Middleware

```javascript
// Conditional access based on role
app.get('/api/cases/:id', rbacMiddleware.conditional([
  { roles: ['admin', 'solicitor'], middleware: null },
  { roles: ['client'], middleware: rbacMiddleware.requireOwnership('cases') }
]), handler);
```

## Installation and Setup

### 1. Run Migration

```bash
# Run the RBAC migration
node scripts/migrate-rbac.js
```

### 2. Restart Server

The server needs to be restarted to load the RBAC middleware:

```bash
npm run server
```

### 3. Verify Setup

Test the RBAC endpoints:

```bash
# Check RBAC stats (requires admin token)
curl -H "Authorization: Bearer <admin-token>" http://localhost:3333/api/rbac/stats

# List roles
curl -H "Authorization: Bearer <admin-token>" http://localhost:3333/api/rbac/roles

# Check user permissions
curl -H "Authorization: Bearer <user-token>" \
     -H "Content-Type: application/json" \
     -d '{"permission": "cases:read"}' \
     http://localhost:3333/api/rbac/check-permission
```

## Security Features

### Audit Logging

All RBAC operations are automatically logged:

- Permission checks (with results)
- Role assignments and removals
- Permission grants and revocals
- Role and permission creation
- Failed access attempts

### Resource Ownership

The system supports resource-level access control:

- Users can access resources they own even without broad permissions
- `*_own` permissions allow access to owned resources only
- Ownership is determined by checking creation relationships

### Permission Inheritance

- Users inherit all permissions from their assigned roles
- Permissions can expire with role assignments
- Multiple roles can be assigned to a single user

## UK Legal Compliance

### SRA Compliance

- Supports SRA Principle 1 (rule of law) through proper access controls
- Audit trails meet regulatory requirements
- Client confidentiality protected through role-based restrictions

### GDPR Compliance

- Data access is logged and trackable
- Client data access is restricted to authorized personnel
- Audit logs support data subject access requests

### Data Retention

- Role assignments can have expiration dates
- Audit logs are retained according to legal requirements
- Inactive roles and permissions can be disabled

## Migration Guide

### From Legacy System

Existing users are automatically migrated:

1. User's current `role` field is mapped to the new role system
2. Appropriate role is assigned in the `user_roles` table
3. Legacy `role` field is maintained for backward compatibility

### Custom Roles

To create custom roles:

```javascript
// Create new role
const roleId = await rbacService.createRole(
  'custom_role', 
  'Custom role description',
  adminUserId
);

// Assign specific permissions
await rbacService.assignPermissionToRole(roleId, permissionId, adminUserId);
```

## Troubleshooting

### Common Issues

1. **403 Forbidden Errors**: Check user has required role/permission
2. **Migration Failures**: Verify database connection and existing schema
3. **RBAC Routes Not Found**: Ensure server restarted after migration

### Debug Commands

```bash
# Check RBAC system status
curl http://localhost:3333/api/rbac/stats

# Verify user permissions
node -e "
const { RBACService } = require('./server/services/rbac.cjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'your-db-url' });
const rbac = new RBACService(pool);
rbac.getUserPermissions('user-id').then(console.log);
"
```

### Logs

RBAC operations are logged with prefixes:
- `✅ RBAC system initialized` - Successful startup
- `❌ Failed to initialize RBAC system` - Initialization error
- `Permission check:` - Individual permission checks
- `Role assignment:` - Role management operations

## Performance Considerations

- Permission checks are optimized with database indexes
- User permissions are cached during request lifecycle
- Role assignments support bulk operations
- Audit logging is asynchronous to avoid blocking requests

## Future Enhancements

- **Role Templates**: Pre-defined role configurations for common scenarios
- **Time-based Permissions**: Permissions that activate/deactivate based on schedules
- **IP-based Restrictions**: Additional security layer for sensitive operations
- **Permission Groups**: Logical groupings of related permissions
- **Dynamic Permissions**: Permissions computed based on business rules