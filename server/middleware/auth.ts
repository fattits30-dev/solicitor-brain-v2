import type { User } from '@shared/schema';
import { NextFunction, Request, Response } from 'express';
import authStandalone from '../auth-standalone.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
    }
  }
}

/**
 * Middleware to authenticate requests using JWT token
 * Now uses the standalone auth system
 */
export const authenticate = authStandalone.requireAuth;

/**
 * Middleware to check if user has required role
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Simple role check
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next();
  }

  const token = parts[1];

  try {
    const payload = authStandalone.verifyToken(token);
    
    if (payload && payload.exp && payload.exp > Date.now()) {
      req.user = {
        id: payload.userId,
        username: payload.username,
        role: payload.role,
        email: payload.username, // Use username as email fallback
        name: payload.username,
        createdAt: new Date(),
        updatedAt: new Date()
      } as User;
      req.token = token;
    }
    next();
  } catch {
    next();
  }
}

// Aliases for backward compatibility and convenience
export const requireAuth = authenticate;
export const requireRole = authorize;