-- RBAC (Role-Based Access Control) Tables for Solicitor Brain v2
-- UK Legal Compliance Implementation

-- Roles table - Define system roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0, -- Higher priority = more permissions
  is_system BOOLEAN DEFAULT false, -- System roles cannot be deleted
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table - Define granular permissions
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(100) NOT NULL, -- e.g., 'cases', 'users', 'documents'
  action VARCHAR(50) NOT NULL, -- e.g., 'create', 'read', 'update', 'delete'
  scope VARCHAR(50) DEFAULT 'own', -- 'own', 'team', 'all'
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action, scope)
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)
);

-- User-Role mapping (many-to-many for flexibility)
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- For temporary role assignments
  UNIQUE(user_id, role_id)
);

-- Permission overrides (user-specific permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true, -- Can be used to explicitly deny
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  reason TEXT, -- Audit trail for why permission was granted/denied
  UNIQUE(user_id, permission_id)
);

-- Resource ownership tracking
CREATE TABLE IF NOT EXISTS resource_access (
  id SERIAL PRIMARY KEY,
  resource_type VARCHAR(100) NOT NULL, -- 'case', 'document', etc.
  resource_id INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  access_level VARCHAR(50) NOT NULL, -- 'owner', 'editor', 'viewer'
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(resource_type, resource_id, user_id)
);

-- Audit log for permission changes
CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL, -- 'role_assigned', 'permission_granted', etc.
  actor_id INTEGER REFERENCES users(id),
  target_user_id INTEGER REFERENCES users(id),
  role_id INTEGER REFERENCES roles(id),
  permission_id INTEGER REFERENCES permissions(id),
  resource_type VARCHAR(100),
  resource_id INTEGER,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_resource_access_lookup ON resource_access(resource_type, resource_id, user_id);
CREATE INDEX idx_rbac_audit_log_actor ON rbac_audit_log(actor_id);
CREATE INDEX idx_rbac_audit_log_target ON rbac_audit_log(target_user_id);
CREATE INDEX idx_rbac_audit_log_created ON rbac_audit_log(created_at);

-- Insert default roles
INSERT INTO roles (name, display_name, description, priority, is_system) VALUES
  ('admin', 'Administrator', 'Full system access, user management, audit logs', 100, true),
  ('solicitor', 'Solicitor', 'Case management, client management, document generation', 75, true),
  ('paralegal', 'Paralegal', 'Limited case access, document preparation, research', 50, true),
  ('client', 'Client', 'Read-only access to own cases and documents', 25, true),
  ('inactive', 'Inactive User', 'No access - account suspended', 0, true)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (resource, action, scope, description) VALUES
  -- User management
  ('users', 'create', 'all', 'Create new users'),
  ('users', 'read', 'all', 'View all users'),
  ('users', 'read', 'team', 'View team members'),
  ('users', 'read', 'own', 'View own profile'),
  ('users', 'update', 'all', 'Update any user'),
  ('users', 'update', 'own', 'Update own profile'),
  ('users', 'delete', 'all', 'Delete any user'),
  
  -- Case management
  ('cases', 'create', 'all', 'Create new cases'),
  ('cases', 'read', 'all', 'View all cases'),
  ('cases', 'read', 'team', 'View team cases'),
  ('cases', 'read', 'own', 'View own cases'),
  ('cases', 'update', 'all', 'Update any case'),
  ('cases', 'update', 'team', 'Update team cases'),
  ('cases', 'update', 'own', 'Update own cases'),
  ('cases', 'delete', 'all', 'Delete any case'),
  ('cases', 'archive', 'all', 'Archive any case'),
  
  -- Document management
  ('documents', 'create', 'all', 'Create documents'),
  ('documents', 'read', 'all', 'View all documents'),
  ('documents', 'read', 'team', 'View team documents'),
  ('documents', 'read', 'own', 'View own documents'),
  ('documents', 'update', 'all', 'Update any document'),
  ('documents', 'update', 'own', 'Update own documents'),
  ('documents', 'delete', 'all', 'Delete any document'),
  ('documents', 'generate', 'all', 'Generate legal documents'),
  ('documents', 'export', 'all', 'Export documents'),
  
  -- AI features
  ('ai', 'chat', 'all', 'Use AI chat features'),
  ('ai', 'generate_draft', 'all', 'Generate AI drafts'),
  ('ai', 'analyze', 'all', 'Use AI analysis'),
  
  -- Audit logs
  ('audit', 'read', 'all', 'View all audit logs'),
  ('audit', 'export', 'all', 'Export audit logs'),
  
  -- Settings
  ('settings', 'read', 'all', 'View system settings'),
  ('settings', 'update', 'all', 'Update system settings'),
  
  -- Compliance
  ('compliance', 'check', 'all', 'Run compliance checks'),
  ('compliance', 'report', 'all', 'Generate compliance reports'),
  
  -- Deadlines
  ('deadlines', 'calculate', 'all', 'Calculate legal deadlines'),
  ('deadlines', 'manage', 'all', 'Manage deadline rules')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Assign permissions to roles
-- Admin gets everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Solicitor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'solicitor'
  AND (
    (p.resource = 'cases' AND p.action IN ('create', 'read', 'update', 'archive') AND p.scope IN ('all', 'team'))
    OR (p.resource = 'documents' AND p.scope IN ('all', 'team'))
    OR (p.resource = 'users' AND p.action = 'read' AND p.scope IN ('team', 'own'))
    OR (p.resource = 'users' AND p.action = 'update' AND p.scope = 'own')
    OR (p.resource = 'ai')
    OR (p.resource = 'compliance')
    OR (p.resource = 'deadlines')
  )
ON CONFLICT DO NOTHING;

-- Paralegal permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'paralegal'
  AND (
    (p.resource = 'cases' AND p.action IN ('read', 'update') AND p.scope IN ('team', 'own'))
    OR (p.resource = 'documents' AND p.action IN ('create', 'read', 'update') AND p.scope IN ('team', 'own'))
    OR (p.resource = 'users' AND p.action IN ('read', 'update') AND p.scope = 'own')
    OR (p.resource = 'ai' AND p.action IN ('chat', 'analyze'))
    OR (p.resource = 'deadlines' AND p.action = 'calculate')
  )
ON CONFLICT DO NOTHING;

-- Client permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'client'
  AND (
    (p.resource = 'cases' AND p.action = 'read' AND p.scope = 'own')
    OR (p.resource = 'documents' AND p.action = 'read' AND p.scope = 'own')
    OR (p.resource = 'users' AND p.action IN ('read', 'update') AND p.scope = 'own')
  )
ON CONFLICT DO NOTHING;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION check_permission(
  p_user_id INTEGER,
  p_resource VARCHAR,
  p_action VARCHAR,
  p_resource_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN;
  user_scope VARCHAR;
BEGIN
  -- Check for explicit user permission override (denied)
  SELECT NOT granted INTO has_permission
  FROM user_permissions up
  JOIN permissions p ON up.permission_id = p.id
  WHERE up.user_id = p_user_id
    AND p.resource = p_resource
    AND p.action = p_action
    AND up.granted = false
    AND (up.expires_at IS NULL OR up.expires_at > NOW())
  LIMIT 1;
  
  IF has_permission IS NOT NULL AND has_permission = true THEN
    RETURN false; -- Explicitly denied
  END IF;

  -- Check for explicit user permission override (granted)
  SELECT granted INTO has_permission
  FROM user_permissions up
  JOIN permissions p ON up.permission_id = p.id
  WHERE up.user_id = p_user_id
    AND p.resource = p_resource
    AND p.action = p_action
    AND up.granted = true
    AND (up.expires_at IS NULL OR up.expires_at > NOW())
  LIMIT 1;
  
  IF has_permission IS NOT NULL AND has_permission = true THEN
    RETURN true; -- Explicitly granted
  END IF;

  -- Check role-based permissions
  SELECT true INTO has_permission
  FROM user_roles ur
  JOIN role_permissions rp ON ur.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = p_user_id
    AND p.resource = p_resource
    AND p.action = p_action
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND (
      p.scope = 'all'
      OR (p.scope = 'team' AND p_resource_id IN (
        SELECT resource_id FROM resource_access 
        WHERE user_id = p_user_id 
        AND resource_type = p_resource
      ))
      OR (p.scope = 'own' AND p_resource_id IN (
        SELECT resource_id FROM resource_access 
        WHERE user_id = p_user_id 
        AND resource_type = p_resource
        AND access_level = 'owner'
      ))
    )
  LIMIT 1;
  
  RETURN COALESCE(has_permission, false);
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();