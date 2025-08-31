const crypto = require('crypto');

class RbacService {
  constructor(db) {
    this.db = db; // PostgreSQL Pool
    this.cache = new Map(); // Simple in-memory cache for permissions
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Get user's roles
  async getUserRoles(userId) {
    try {
      const result = await this.db.query(`
        SELECT r.id, r.name, r.priority, ur.expires_at
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        ORDER BY r.priority DESC
      `, [userId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting user roles:', error);
      return [];
    }
  }

  // Check if user has a specific role
  async hasRole(userId, roleName) {
    try {
      const result = await this.db.query(`
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND r.name = $2
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        LIMIT 1
      `, [userId, roleName]);

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking role:', error);
      return false;
    }
  }

  // Get user's permissions
  async getUserPermissions(userId) {
    const cacheKey = `permissions:${userId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      // Get role-based permissions
      const rolePerms = await this.db.query(`
        SELECT DISTINCT p.id, p.resource, p.action
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = $1
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [userId]);

      // Get user-specific permission overrides
      const userPerms = await this.db.query(`
        SELECT p.id, p.resource, p.action, up.granted
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = $1
          AND (up.expires_at IS NULL OR up.expires_at > NOW())
      `, [userId]);

      // Combine permissions
      const permissions = new Map();
      
      // Add role permissions
      rolePerms.rows.forEach(perm => {
        const key = `${perm.resource}:${perm.action}`;
        permissions.set(key, true);
      });

      // Apply user overrides
      userPerms.rows.forEach(perm => {
        const key = `${perm.resource}:${perm.action}`;
        if (perm.granted === false) {
          permissions.delete(key); // Remove if explicitly denied
        } else {
          permissions.set(key, true);
        }
      });

      const result = Array.from(permissions.keys());
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        expires: Date.now() + this.cacheTimeout
      });

      return result;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  // Check if user has a specific permission
  async hasPermission(userId, resource, action, resourceId = null) {
    try {
      // Check if user is admin (bypass all checks)
      if (await this.hasRole(userId, 'admin')) {
        return true;
      }

      // Check for explicit denial
      const denied = await this.db.query(`
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = $1
          AND p.resource = $2
          AND p.action = $3
          AND up.granted = false
          AND (up.expires_at IS NULL OR up.expires_at > NOW())
        LIMIT 1
      `, [userId, resource, action]);

      if (denied.rows.length > 0) {
        return false;
      }

      // Check for explicit grant
      const granted = await this.db.query(`
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = $1
          AND p.resource = $2
          AND p.action = $3
          AND up.granted = true
          AND (up.expires_at IS NULL OR up.expires_at > NOW())
        LIMIT 1
      `, [userId, resource, action]);

      if (granted.rows.length > 0) {
        return true;
      }

      // Check role-based permissions
      const rolePermission = await this.db.query(`
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = $1
          AND p.resource = $2
          AND p.action = $3
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        LIMIT 1
      `, [userId, resource, action]);

      return rolePermission.rows.length > 0;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  // Check resource ownership
  async hasResourceAccess(userId, resourceType, resourceId, requiredLevel = 'viewer') {
    try {
      const result = await this.db.query(`
        SELECT access_level FROM resource_access
        WHERE user_id = $1
          AND resource_type = $2
          AND resource_id = $3
          AND (expires_at IS NULL OR expires_at > NOW())
      `, [userId, resourceType, resourceId]);

      if (result.rows.length === 0) {
        return false;
      }

      const accessLevel = result.rows[0].access_level;
      const levels = ['viewer', 'editor', 'owner'];
      
      return levels.indexOf(accessLevel) >= levels.indexOf(requiredLevel);
    } catch (error) {
      console.error('Error checking resource access:', error);
      return false;
    }
  }

  // Assign role to user
  async assignRole(userId, roleName, assignedBy, expiresAt = null) {
    try {
      // Get role ID
      const roleResult = await this.db.query(
        'SELECT id FROM roles WHERE name = $1',
        [roleName]
      );

      if (roleResult.rows.length === 0) {
        throw new Error(`Role ${roleName} not found`);
      }

      const roleId = roleResult.rows[0].id;

      // Assign role
      await this.db.query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, role_id) DO UPDATE
        SET assigned_by = $3, assigned_at = NOW(), expires_at = $4
      `, [userId, roleId, assignedBy, expiresAt]);

      // Log the action
      await this.logAction('role_assigned', assignedBy, userId, roleId);

      // Clear cache
      this.clearUserCache(userId);

      return { success: true };
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }
  }

  // Remove role from user
  async removeRole(userId, roleName, removedBy) {
    try {
      // Get role ID
      const roleResult = await this.db.query(
        'SELECT id FROM roles WHERE name = $1',
        [roleName]
      );

      if (roleResult.rows.length === 0) {
        throw new Error(`Role ${roleName} not found`);
      }

      const roleId = roleResult.rows[0].id;

      // Remove role
      await this.db.query(
        'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
        [userId, roleId]
      );

      // Log the action
      await this.logAction('role_removed', removedBy, userId, roleId);

      // Clear cache
      this.clearUserCache(userId);

      return { success: true };
    } catch (error) {
      console.error('Error removing role:', error);
      throw error;
    }
  }

  // Grant resource access
  async grantResourceAccess(userId, resourceType, resourceId, accessLevel, grantedBy, expiresAt = null) {
    try {
      await this.db.query(`
        INSERT INTO resource_access (resource_type, resource_id, user_id, access_level, granted_by, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (resource_type, resource_id, user_id) DO UPDATE
        SET access_level = $4, granted_by = $5, granted_at = NOW(), expires_at = $6
      `, [resourceType, resourceId, userId, accessLevel, grantedBy, expiresAt]);

      // Log the action
      await this.logAction('resource_access_granted', grantedBy, userId, null, null, resourceType, resourceId);

      return { success: true };
    } catch (error) {
      console.error('Error granting resource access:', error);
      throw error;
    }
  }

  // Revoke resource access
  async revokeResourceAccess(userId, resourceType, resourceId, revokedBy) {
    try {
      await this.db.query(
        'DELETE FROM resource_access WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3',
        [userId, resourceType, resourceId]
      );

      // Log the action
      await this.logAction('resource_access_revoked', revokedBy, userId, null, null, resourceType, resourceId);

      return { success: true };
    } catch (error) {
      console.error('Error revoking resource access:', error);
      throw error;
    }
  }

  // Log RBAC action for audit trail
  async logAction(actionType, actorId, targetUserId, roleId = null, permissionId = null, resourceType = null, resourceId = null, reason = null) {
    try {
      await this.db.query(`
        INSERT INTO rbac_audit_log (action_type, actor_id, target_user_id, role_id, permission_id, resource_type, resource_id, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [actionType, actorId, targetUserId, roleId, permissionId, resourceType, resourceId, reason]);
    } catch (error) {
      console.error('Error logging RBAC action:', error);
    }
  }

  // Get audit log for a user
  async getUserAuditLog(userId, limit = 50) {
    try {
      const result = await this.db.query(`
        SELECT 
          ral.*,
          actor.name as actor_name,
          target.name as target_name,
          r.name as role_name
        FROM rbac_audit_log ral
        LEFT JOIN users actor ON ral.actor_id = actor.id
        LEFT JOIN users target ON ral.target_user_id = target.id
        LEFT JOIN roles r ON ral.role_id = r.id
        WHERE ral.target_user_id = $1 OR ral.actor_id = $1
        ORDER BY ral.created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows;
    } catch (error) {
      console.error('Error getting audit log:', error);
      return [];
    }
  }

  // Clear user cache
  clearUserCache(userId) {
    const cacheKey = `permissions:${userId}`;
    this.cache.delete(cacheKey);
  }

  // Clear all cache
  clearAllCache() {
    this.cache.clear();
  }

  // Get all roles
  async getAllRoles() {
    try {
      const result = await this.db.query(
        'SELECT * FROM roles ORDER BY priority DESC'
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting roles:', error);
      return [];
    }
  }

  // Get all permissions
  async getAllPermissions() {
    try {
      const result = await this.db.query(
        'SELECT * FROM permissions ORDER BY resource, action'
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting permissions:', error);
      return [];
    }
  }

  // Get role permissions
  async getRolePermissions(roleName) {
    try {
      const result = await this.db.query(`
        SELECT p.* FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        WHERE r.name = $1
        ORDER BY p.resource, p.action
      `, [roleName]);

      return result.rows;
    } catch (error) {
      console.error('Error getting role permissions:', error);
      return [];
    }
  }

  // UK Legal Compliance specific methods
  async checkSRACompliance(userId, action) {
    // Check SRA (Solicitors Regulation Authority) compliance
    const isSolicitor = await this.hasRole(userId, 'solicitor');
    const isParalegal = await this.hasRole(userId, 'paralegal');
    
    // Certain actions require qualified solicitor
    const solicitorOnlyActions = [
      'sign_legal_document',
      'provide_legal_advice',
      'represent_in_court',
      'handle_client_money'
    ];

    if (solicitorOnlyActions.includes(action) && !isSolicitor) {
      return {
        compliant: false,
        reason: 'This action requires a qualified solicitor'
      };
    }

    return { compliant: true };
  }

  async checkGDPRCompliance(userId, resource, action) {
    // Check GDPR compliance for data access
    if (resource === 'personal_data') {
      // Log access for GDPR audit trail
      await this.logAction('gdpr_data_access', userId, null, null, null, resource, null, `Action: ${action}`);
      
      // Check if user has valid reason for access
      const hasConsent = await this.hasPermission(userId, 'gdpr', 'access_personal_data');
      
      if (!hasConsent) {
        return {
          compliant: false,
          reason: 'GDPR: No valid legal basis for accessing personal data'
        };
      }
    }

    return { compliant: true };
  }
}

module.exports = RbacService;