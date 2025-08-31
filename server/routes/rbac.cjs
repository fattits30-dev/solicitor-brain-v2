const express = require('express');
const { RBACService } = require('../services/rbac.cjs');

/**
 * RBAC API Routes
 * 
 * Provides endpoints for role and permission management.
 * All endpoints require appropriate permissions and include audit logging.
 */
function createRBACRoutes(pool, rbacMiddleware) {
  const router = express.Router();
  const rbacService = new RBACService(pool);

  // ============ ROLES MANAGEMENT ============

  /**
   * GET /api/rbac/roles
   * List all roles with user and permission counts
   */
  router.get('/roles', 
    rbacMiddleware.requirePermission('system:admin'),
    async (req, res) => {
      try {
        const roles = await rbacService.getAllRoles();
        res.json({
          roles,
          total: roles.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ 
          error: 'Failed to fetch roles',
          code: 'ROLES_FETCH_ERROR' 
        });
      }
    }
  );

  /**
   * POST /api/rbac/roles
   * Create a new role
   */
  router.post('/roles',
    rbacMiddleware.requirePermission('system:admin'),
    async (req, res) => {
      try {
        const { name, description } = req.body;
        
        if (!name) {
          return res.status(400).json({ 
            error: 'Role name is required',
            code: 'ROLE_NAME_REQUIRED' 
          });
        }

        const roleId = await rbacService.createRole(name, description, req.user.id);
        
        res.status(201).json({
          id: roleId,
          name,
          description,
          created: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Create role error:', error);
        
        if (error.code === '23505') { // Unique constraint violation
          return res.status(409).json({ 
            error: 'Role name already exists',
            code: 'ROLE_NAME_EXISTS' 
          });
        }
        
        res.status(500).json({ 
          error: 'Failed to create role',
          code: 'ROLE_CREATE_ERROR' 
        });
      }
    }
  );

  /**
   * GET /api/rbac/roles/:roleId/permissions
   * Get permissions for a specific role
   */
  router.get('/roles/:roleId/permissions',
    rbacMiddleware.requirePermission('system:admin'),
    async (req, res) => {
      try {
        const { roleId } = req.params;
        
        const query = `
          SELECT p.id, p.name, p.resource, p.action, p.description, rp.granted_at
          FROM role_permissions rp
          JOIN permissions p ON rp.permission_id = p.id
          WHERE rp.role_id = $1 AND p.is_active = true
          ORDER BY p.resource, p.action
        `;
        
        const result = await pool.query(query, [roleId]);
        
        res.json({
          roleId,
          permissions: result.rows,
          total: result.rows.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Get role permissions error:', error);
        res.status(500).json({ 
          error: 'Failed to fetch role permissions',
          code: 'ROLE_PERMISSIONS_FETCH_ERROR' 
        });
      }
    }
  );

  // ============ PERMISSIONS MANAGEMENT ============

  /**
   * GET /api/rbac/permissions
   * List all permissions with role counts
   */
  router.get('/permissions',
    rbacMiddleware.requirePermission('system:admin'),
    async (req, res) => {
      try {
        const permissions = await rbacService.getAllPermissions();
        res.json({
          permissions,
          total: permissions.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ 
          error: 'Failed to fetch permissions',
          code: 'PERMISSIONS_FETCH_ERROR' 
        });
      }
    }
  );

  /**
   * POST /api/rbac/permissions
   * Create a new permission
   */
  router.post('/permissions',
    rbacMiddleware.requirePermission('system:admin'),
    async (req, res) => {
      try {
        const { name, resource, action, description } = req.body;
        
        if (!name || !resource || !action) {
          return res.status(400).json({ 
            error: 'Permission name, resource, and action are required',
            code: 'PERMISSION_FIELDS_REQUIRED' 
          });
        }

        const permissionId = await rbacService.createPermission(
          name, resource, action, description, req.user.id
        );
        
        res.status(201).json({
          id: permissionId,
          name,
          resource,
          action,
          description,
          created: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Create permission error:', error);
        
        if (error.code === '23505') { // Unique constraint violation
          return res.status(409).json({ 
            error: 'Permission name already exists',
            code: 'PERMISSION_NAME_EXISTS' 
          });
        }
        
        res.status(500).json({ 
          error: 'Failed to create permission',
          code: 'PERMISSION_CREATE_ERROR' 
        });
      }
    }
  );

  // ============ ROLE-PERMISSION ASSIGNMENTS ============

  /**
   * POST /api/rbac/roles/:roleId/permissions/:permissionId
   * Assign permission to role
   */
  router.post('/roles/:roleId/permissions/:permissionId',
    rbacMiddleware.requirePermission('system:admin'),
    async (req, res) => {
      try {
        const { roleId, permissionId } = req.params;
        
        await rbacService.assignPermissionToRole(roleId, permissionId, req.user.id);
        
        res.json({
          roleId,
          permissionId,
          assigned: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Assign permission to role error:', error);
        
        if (error.message.includes('already assigned')) {
          return res.status(409).json({ 
            error: 'Permission already assigned to role',
            code: 'PERMISSION_ALREADY_ASSIGNED' 
          });
        }
        
        res.status(500).json({ 
          error: 'Failed to assign permission to role',
          code: 'PERMISSION_ASSIGNMENT_ERROR' 
        });
      }
    }
  );

  /**
   * DELETE /api/rbac/roles/:roleId/permissions/:permissionId
   * Remove permission from role
   */
  router.delete('/roles/:roleId/permissions/:permissionId',
    rbacMiddleware.requirePermission('system:admin'),
    async (req, res) => {
      try {
        const { roleId, permissionId } = req.params;
        
        await rbacService.removePermissionFromRole(roleId, permissionId, req.user.id);
        
        res.json({
          roleId,
          permissionId,
          removed: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Remove permission from role error:', error);
        
        if (error.message.includes('not found')) {
          return res.status(404).json({ 
            error: 'Permission assignment not found',
            code: 'PERMISSION_ASSIGNMENT_NOT_FOUND' 
          });
        }
        
        res.status(500).json({ 
          error: 'Failed to remove permission from role',
          code: 'PERMISSION_REMOVAL_ERROR' 
        });
      }
    }
  );

  // ============ USER ROLE ASSIGNMENTS ============

  /**
   * GET /api/rbac/users/:userId/roles
   * Get roles for a specific user
   */
  router.get('/users/:userId/roles',
    rbacMiddleware.requireAnyPermission(['system:admin', 'users:read']),
    async (req, res) => {
      try {
        const { userId } = req.params;
        
        // Check if user can access this information
        if (req.user.id !== userId) {
          const hasPermission = await rbacService.hasPermission(req.user.id, 'users:read');
          if (!hasPermission) {
            return res.status(403).json({ 
              error: 'Access denied - can only view own roles',
              code: 'ACCESS_DENIED' 
            });
          }
        }
        
        const roles = await rbacService.getUserRoles(userId);
        
        res.json({
          userId,
          roles,
          total: roles.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Get user roles error:', error);
        res.status(500).json({ 
          error: 'Failed to fetch user roles',
          code: 'USER_ROLES_FETCH_ERROR' 
        });
      }
    }
  );

  /**
   * GET /api/rbac/users/:userId/permissions
   * Get effective permissions for a specific user
   */
  router.get('/users/:userId/permissions',
    rbacMiddleware.requireAnyPermission(['system:admin', 'users:read']),
    async (req, res) => {
      try {
        const { userId } = req.params;
        
        // Check if user can access this information
        if (req.user.id !== userId) {
          const hasPermission = await rbacService.hasPermission(req.user.id, 'users:read');
          if (!hasPermission) {
            return res.status(403).json({ 
              error: 'Access denied - can only view own permissions',
              code: 'ACCESS_DENIED' 
            });
          }
        }
        
        const permissions = await rbacService.getUserPermissions(userId);
        
        res.json({
          userId,
          permissions,
          total: permissions.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Get user permissions error:', error);
        res.status(500).json({ 
          error: 'Failed to fetch user permissions',
          code: 'USER_PERMISSIONS_FETCH_ERROR' 
        });
      }
    }
  );

  /**
   * POST /api/rbac/users/:userId/roles/:roleId
   * Assign role to user
   */
  router.post('/users/:userId/roles/:roleId',
    rbacMiddleware.requirePermission('users:update'),
    async (req, res) => {
      try {
        const { userId, roleId } = req.params;
        const { expiresAt } = req.body;
        
        await rbacService.assignRole(userId, roleId, req.user.id, expiresAt);
        
        res.json({
          userId,
          roleId,
          assigned: true,
          expiresAt,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Assign role to user error:', error);
        
        if (error.message.includes('already assigned')) {
          return res.status(409).json({ 
            error: 'Role already assigned to user',
            code: 'ROLE_ALREADY_ASSIGNED' 
          });
        }
        
        res.status(500).json({ 
          error: 'Failed to assign role to user',
          code: 'ROLE_ASSIGNMENT_ERROR' 
        });
      }
    }
  );

  /**
   * DELETE /api/rbac/users/:userId/roles/:roleId
   * Remove role from user
   */
  router.delete('/users/:userId/roles/:roleId',
    rbacMiddleware.requirePermission('users:update'),
    async (req, res) => {
      try {
        const { userId, roleId } = req.params;
        
        await rbacService.removeRole(userId, roleId, req.user.id);
        
        res.json({
          userId,
          roleId,
          removed: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Remove role from user error:', error);
        
        if (error.message.includes('not found')) {
          return res.status(404).json({ 
            error: 'Role assignment not found',
            code: 'ROLE_ASSIGNMENT_NOT_FOUND' 
          });
        }
        
        res.status(500).json({ 
          error: 'Failed to remove role from user',
          code: 'ROLE_REMOVAL_ERROR' 
        });
      }
    }
  );

  // ============ PERMISSION CHECKING ENDPOINTS ============

  /**
   * POST /api/rbac/check-permission
   * Check if user has a specific permission
   */
  router.post('/check-permission',
    rbacMiddleware.requireAuth(),
    async (req, res) => {
      try {
        const { permission, resourceId } = req.body;
        const userId = req.body.userId || req.user.id;
        
        // Users can only check their own permissions unless they have admin access
        if (userId !== req.user.id) {
          const hasAdminAccess = await rbacService.hasPermission(req.user.id, 'system:admin');
          if (!hasAdminAccess) {
            return res.status(403).json({ 
              error: 'Can only check own permissions',
              code: 'ACCESS_DENIED' 
            });
          }
        }
        
        const hasPermission = await rbacService.hasPermission(userId, permission, resourceId);
        
        res.json({
          userId,
          permission,
          resourceId,
          hasPermission,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Check permission error:', error);
        res.status(500).json({ 
          error: 'Permission check failed',
          code: 'PERMISSION_CHECK_ERROR' 
        });
      }
    }
  );

  /**
   * POST /api/rbac/check-access
   * Check if user has access to a specific resource
   */
  router.post('/check-access',
    rbacMiddleware.requireAuth(),
    async (req, res) => {
      try {
        const { resource, action, resourceId } = req.body;
        const userId = req.body.userId || req.user.id;
        
        // Users can only check their own access unless they have admin access
        if (userId !== req.user.id) {
          const hasAdminAccess = await rbacService.hasPermission(req.user.id, 'system:admin');
          if (!hasAdminAccess) {
            return res.status(403).json({ 
              error: 'Can only check own access',
              code: 'ACCESS_DENIED' 
            });
          }
        }
        
        const hasAccess = await rbacService.checkAccess(userId, resource, action, resourceId);
        
        res.json({
          userId,
          resource,
          action,
          resourceId,
          hasAccess,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Check access error:', error);
        res.status(500).json({ 
          error: 'Access check failed',
          code: 'ACCESS_CHECK_ERROR' 
        });
      }
    }
  );

  // ============ AUDIT AND REPORTING ============

  /**
   * GET /api/rbac/audit/permissions
   * Get audit log for permission checks
   */
  router.get('/audit/permissions',
    rbacMiddleware.requirePermission('audit:read'),
    async (req, res) => {
      try {
        const { limit = 100, offset = 0, userId } = req.query;
        
        let query = `
          SELECT al.*, u.username
          FROM audit_log al
          JOIN users u ON al.user_id = u.id
          WHERE al.resource = 'rbac' AND al.action = 'permission_check'
        `;
        const params = [];
        
        if (userId) {
          query += ' AND al.user_id = $1';
          params.push(userId);
        }
        
        query += ' ORDER BY al.timestamp DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await pool.query(query, params);
        
        res.json({
          auditLog: result.rows,
          total: result.rows.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Get permission audit error:', error);
        res.status(500).json({ 
          error: 'Failed to fetch permission audit log',
          code: 'AUDIT_FETCH_ERROR' 
        });
      }
    }
  );

  /**
   * GET /api/rbac/stats
   * Get RBAC system statistics
   */
  router.get('/stats',
    rbacMiddleware.requirePermission('system:admin'),
    async (req, res) => {
      try {
        const [rolesResult, permissionsResult, usersWithRolesResult, activeAssignmentsResult] = await Promise.all([
          pool.query('SELECT COUNT(*) as count FROM roles WHERE is_active = true'),
          pool.query('SELECT COUNT(*) as count FROM permissions WHERE is_active = true'),
          pool.query('SELECT COUNT(DISTINCT user_id) as count FROM user_roles WHERE expires_at IS NULL OR expires_at > NOW()'),
          pool.query('SELECT COUNT(*) as count FROM user_roles WHERE expires_at IS NULL OR expires_at > NOW()')
        ]);

        res.json({
          stats: {
            totalRoles: parseInt(rolesResult.rows[0].count),
            totalPermissions: parseInt(permissionsResult.rows[0].count),
            usersWithRoles: parseInt(usersWithRolesResult.rows[0].count),
            activeAssignments: parseInt(activeAssignmentsResult.rows[0].count)
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Get RBAC stats error:', error);
        res.status(500).json({ 
          error: 'Failed to fetch RBAC statistics',
          code: 'STATS_FETCH_ERROR' 
        });
      }
    }
  );

  return router;
}

module.exports = { createRBACRoutes };