-- Migration: 008-rbac-system
-- Description: Create Role-Based Access Control (RBAC) system tables
-- Date: 2025-08-31

BEGIN;

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ ROLES TABLE ============
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for roles
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);

-- ============ PERMISSIONS TABLE ============
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for permissions
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(is_active);

-- ============ ROLE_PERMISSIONS TABLE ============
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT NOW() NOT NULL,
    granted_by TEXT REFERENCES users(id),
    UNIQUE(role_id, permission_id)
);

-- Create indexes for role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_granted_by ON role_permissions(granted_by);

-- ============ USER_ROLES TABLE ============
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
    assigned_by TEXT REFERENCES users(id),
    expires_at TIMESTAMP,
    UNIQUE(user_id, role_id)
);

-- Create indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON user_roles(assigned_by);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires_at ON user_roles(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, role_id, expires_at);

-- ============ INSERT DEFAULT ROLES ============
INSERT INTO roles (name, description) VALUES
    ('admin', 'Full system access, user management, audit logs'),
    ('solicitor', 'Case management, client management, document generation'),
    ('paralegal', 'Limited case access, document preparation, research'),
    ('client', 'Read-only access to their own cases')
ON CONFLICT (name) DO NOTHING;

-- ============ INSERT DEFAULT PERMISSIONS ============
INSERT INTO permissions (name, resource, action, description) VALUES
    -- System permissions
    ('system:admin', 'system', 'admin', 'Full system administration'),
    ('system:audit', 'system', 'audit', 'Access audit logs'),
    
    -- User management
    ('users:create', 'users', 'create', 'Create new users'),
    ('users:read', 'users', 'read', 'View user information'),
    ('users:update', 'users', 'update', 'Update user information'),
    ('users:delete', 'users', 'delete', 'Delete users'),
    
    -- Case management
    ('cases:create', 'cases', 'create', 'Create new cases'),
    ('cases:read', 'cases', 'read', 'View case information'),
    ('cases:update', 'cases', 'update', 'Update case information'),
    ('cases:delete', 'cases', 'delete', 'Delete cases'),
    ('cases:read_own', 'cases', 'read_own', 'View own cases only'),
    
    -- Document management
    ('documents:create', 'documents', 'create', 'Upload and create documents'),
    ('documents:read', 'documents', 'read', 'View documents'),
    ('documents:update', 'documents', 'update', 'Update document metadata'),
    ('documents:delete', 'documents', 'delete', 'Delete documents'),
    ('documents:generate', 'documents', 'generate', 'Generate AI documents'),
    
    -- Client management
    ('clients:create', 'clients', 'create', 'Add new clients'),
    ('clients:read', 'clients', 'read', 'View client information'),
    ('clients:update', 'clients', 'update', 'Update client information'),
    ('clients:delete', 'clients', 'delete', 'Remove clients'),
    
    -- AI features
    ('ai:chat', 'ai', 'chat', 'Use AI chat functionality'),
    ('ai:research', 'ai', 'research', 'Use AI legal research'),
    ('ai:generate', 'ai', 'generate', 'Generate AI content'),
    
    -- Compliance and audit
    ('compliance:check', 'compliance', 'check', 'Run compliance checks'),
    ('audit:read', 'audit', 'read', 'View audit logs'),
    
    -- Deadlines and workflow
    ('deadlines:calculate', 'deadlines', 'calculate', 'Calculate legal deadlines'),
    ('workflow:manage', 'workflow', 'manage', 'Manage case workflows')
ON CONFLICT (name) DO NOTHING;

-- ============ ASSIGN PERMISSIONS TO ROLES ============

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Solicitor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'solicitor' 
AND p.name IN (
    'cases:create', 'cases:read', 'cases:update', 'cases:delete',
    'documents:create', 'documents:read', 'documents:update', 'documents:delete', 'documents:generate',
    'clients:create', 'clients:read', 'clients:update', 'clients:delete',
    'ai:chat', 'ai:research', 'ai:generate',
    'compliance:check',
    'deadlines:calculate',
    'workflow:manage',
    'users:read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Paralegal permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'paralegal'
AND p.name IN (
    'cases:read', 'cases:update',
    'documents:create', 'documents:read', 'documents:update', 'documents:generate',
    'clients:read', 'clients:update',
    'ai:chat', 'ai:research', 'ai:generate',
    'deadlines:calculate'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Client permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'client'
AND p.name IN (
    'cases:read_own',
    'documents:read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============ MIGRATE EXISTING USERS ============
-- Assign roles to existing users based on their current role field

-- Create admin user if not exists and assign admin role
DO $$
DECLARE
    admin_user_id TEXT;
    admin_role_id UUID;
BEGIN
    -- Get or create admin user
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@solicitor-brain.com';
    
    IF admin_user_id IS NULL THEN
        -- Generate a random UUID-like ID for the admin user
        admin_user_id := 'admin-' || substring(gen_random_uuid()::text, 1, 8);
        
        INSERT INTO users (id, email, name, role, password, "isActive", "createdAt", "updatedAt")
        VALUES (admin_user_id, 'admin@solicitor-brain.com', 'Administrator', 'ADMIN', '$2b$10$dummy.hash.for.setup', true, NOW(), NOW());
    END IF;
    
    -- Get admin role
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
    
    -- Assign admin role
    INSERT INTO user_roles (user_id, role_id, assigned_by)
    VALUES (admin_user_id, admin_role_id, admin_user_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
END $$;

-- Assign roles to all existing users based on their role field (with enum mapping)
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT 
    u.id as user_id,
    r.id as role_id,
    (SELECT id FROM users WHERE email = 'admin@solicitor-brain.com' LIMIT 1) as assigned_by
FROM users u
JOIN roles r ON (
    (u.role = 'ADMIN' AND r.name = 'admin') OR
    (u.role = 'SUPER_ADMIN' AND r.name = 'admin') OR
    (u.role = 'ATTORNEY' AND r.name = 'solicitor') OR
    (u.role = 'USER' AND r.name = 'client')
)
WHERE NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id AND ur.role_id = r.id
);

-- ============ CREATE AUDIT TRIGGERS ============

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for roles table
CREATE TRIGGER update_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============ CREATE VIEWS FOR EASY QUERYING ============

-- View for user permissions (flattened)
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT DISTINCT
    u.id as user_id,
    u.email,
    u.name as user_name,
    p.id as permission_id,
    p.name as permission_name,
    p.resource,
    p.action,
    p.description as permission_description,
    r.name as role_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.is_active = true 
    AND p.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());

-- View for role summary
CREATE OR REPLACE VIEW role_summary_view AS
SELECT 
    r.id,
    r.name,
    r.description,
    r.is_active,
    COUNT(DISTINCT ur.user_id) as user_count,
    COUNT(DISTINCT rp.permission_id) as permission_count,
    r.created_at,
    r.updated_at
FROM roles r
LEFT JOIN user_roles ur ON r.id = ur.role_id AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.name, r.description, r.is_active, r.created_at, r.updated_at;

-- ============ SECURITY POLICIES ============

-- Enable Row Level Security on sensitive tables
-- ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies would be defined here based on specific security requirements
-- For now, we rely on application-level permission checks

-- ============ GRANTS ============

-- Grant necessary permissions to the application user
-- Note: These would be customized based on your database user setup
-- GRANT SELECT, INSERT, UPDATE, DELETE ON roles TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON permissions TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_roles TO your_app_user;

COMMIT;

-- ============ VERIFICATION QUERIES ============
-- Run these after migration to verify setup

-- Check role counts
-- SELECT 'Roles created:' as check, count(*) as count FROM roles;

-- Check permission counts  
-- SELECT 'Permissions created:' as check, count(*) as count FROM permissions;

-- Check admin role permissions
-- SELECT 'Admin permissions:' as check, count(*) as count 
-- FROM role_permissions rp 
-- JOIN roles r ON rp.role_id = r.id 
-- WHERE r.name = 'admin';

-- Check user role assignments
-- SELECT 'User role assignments:' as check, count(*) as count FROM user_roles;

-- Verify admin user setup
-- SELECT 'Admin user setup:' as check, 
--        CASE WHEN EXISTS(
--            SELECT 1 FROM user_roles ur 
--            JOIN roles r ON ur.role_id = r.id 
--            JOIN users u ON ur.user_id = u.id
--            WHERE u.email = 'admin@solicitor-brain.com' AND r.name = 'admin'
--        ) THEN 'SUCCESS' ELSE 'FAILED' END as status;