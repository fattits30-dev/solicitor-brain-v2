import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.js";
import type { User } from "../../shared/schema.js";

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
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Invalid authorization format" });
    }

    const token = parts[1];

    // Verify token
    try {
      const payload = AuthService.verifyToken(token);
      
      // Get user from database - Fixed async handling
      AuthService.getUserById(payload.userId).then(user => {
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }

        // Attach user and token to request
        req.user = user;
        req.token = token;
        next();
      }).catch(error => {
        console.error("Auth middleware error:", error);
        return res.status(500).json({ error: "Authentication failed" });
      });
      return; // Prevent further execution while promise resolves
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Middleware to check if user has required role
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!AuthService.hasRole(req.user, allowedRoles)) {
      return res.status(403).json({ error: "Insufficient permissions" });
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

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return next();
  }

  const token = parts[1];

  try {
    const payload = AuthService.verifyToken(token);
    
    AuthService.getUserById(payload.userId).then(user => {
      if (user) {
        req.user = user;
        req.token = token;
      }
      next();
    }).catch(() => {
      next();
    });
    return; // Prevent further execution while promise resolves
  } catch {
    next();
  }
}
// Aliases for backward compatibility and convenience
export const requireAuth = authenticate;
export const requireRole = authorize;
