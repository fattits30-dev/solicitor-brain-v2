const RbacService = require('../services/rbac.cjs');

let rbacService;

function initializeRbacMiddleware(db) {
  rbacService = new RbacService(db);
}

// Middleware to check permissions
function requirePermission(resource, action) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const resourceId = req.params.id || req.body.resourceId || null;

      // Check permission
      const hasPermission = await rbacService.hasPermission(userId, resource, action, resourceId);

      if (!hasPermission) {
        // Log the denied access attempt
        await rbacService.logAction('access_denied', userId, null, null, null, resource, resourceId, `Action: ${action}`);
        
        return res.status(403).json({ 
          error: 'Permission denied',
          required: `${resource}:${action}`
        });
      }

      // Check UK legal compliance
      const sraCompliance = await rbacService.checkSRACompliance(userId, action);
      if (!sraCompliance.compliant) {
        return res.status(403).json({ 
          error: 'Compliance violation',
          reason: sraCompliance.reason
        });
      }

      // Check GDPR compliance for personal data
      if (resource.includes('personal') || resource.includes('client')) {
        const gdprCompliance = await rbacService.checkGDPRCompliance(userId, resource, action);
        if (!gdprCompliance.compliant) {
          return res.status(403).json({ 
            error: 'GDPR compliance violation',
            reason: gdprCompliance.reason
          });
        }
      }

      // Add user permissions to request for use in controllers
      req.permissions = await rbacService.getUserPermissions(userId);
      req.roles = await rbacService.getUserRoles(userId);

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

// Middleware to check role
function requireRole(roleName) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasRole = await rbacService.hasRole(req.user.id, roleName);

      if (!hasRole) {
        await rbacService.logAction('role_access_denied', req.user.id, null, null, null, null, null, `Required role: ${roleName}`);
        
        return res.status(403).json({ 
          error: 'Insufficient privileges',
          required_role: roleName
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Role check failed' });
    }
  };
}

// Middleware to check resource ownership
function requireResourceAccess(resourceType, accessLevel = 'viewer') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const resourceId = req.params.id || req.body.resourceId;
      
      if (!resourceId) {
        return res.status(400).json({ error: 'Resource ID required' });
      }

      // Admins bypass resource checks
      if (await rbacService.hasRole(req.user.id, 'admin')) {
        return next();
      }

      const hasAccess = await rbacService.hasResourceAccess(
        req.user.id,
        resourceType,
        resourceId,
        accessLevel
      );

      if (!hasAccess) {
        await rbacService.logAction(
          'resource_access_denied',
          req.user.id,
          null,
          null,
          null,
          resourceType,
          resourceId,
          `Required level: ${accessLevel}`
        );
        
        return res.status(403).json({ 
          error: 'Access denied',
          resource: resourceType,
          required_level: accessLevel
        });
      }

      next();
    } catch (error) {
      console.error('Resource access check error:', error);
      res.status(500).json({ error: 'Access check failed' });
    }
  };
}

// Middleware to add user permissions to request
async function loadUserPermissions(req, res, next) {
  try {
    if (req.user) {
      req.permissions = await rbacService.getUserPermissions(req.user.id);
      req.roles = await rbacService.getUserRoles(req.user.id);
    }
    next();
  } catch (error) {
    console.error('Error loading user permissions:', error);
    next(); // Continue even if permissions can't be loaded
  }
}

// Helper function to check multiple permissions (OR logic)
function requireAnyPermission(...permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      for (const [resource, action] of permissions) {
        const hasPermission = await rbacService.hasPermission(req.user.id, resource, action);
        if (hasPermission) {
          return next();
        }
      }

      return res.status(403).json({ 
        error: 'Permission denied',
        required_any: permissions.map(([r, a]) => `${r}:${a}`)
      });
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

// Helper function to check multiple permissions (AND logic)
function requireAllPermissions(...permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      for (const [resource, action] of permissions) {
        const hasPermission = await rbacService.hasPermission(req.user.id, resource, action);
        if (!hasPermission) {
          return res.status(403).json({ 
            error: 'Permission denied',
            missing: `${resource}:${action}`
          });
        }
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

// Export the service instance for direct access
function getRbacService() {
  return rbacService;
}

module.exports = {
  initializeRbacMiddleware,
  requirePermission,
  requireRole,
  requireResourceAccess,
  loadUserPermissions,
  requireAnyPermission,
  requireAllPermissions,
  getRbacService
};