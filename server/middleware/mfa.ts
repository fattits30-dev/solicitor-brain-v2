import { Request, Response, NextFunction } from 'express';
import { mfaService } from '../services/mfa';

declare global {
  namespace Express {
    interface Request {
      mfaVerified?: boolean;
      deviceTrusted?: boolean;
      mfaRequired?: boolean;
      session?: any;
      user?: {
        id: string;
        username: string;
        password: string;
        name: string;
        role: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

/**
 * Middleware to check MFA requirements
 */
export function checkMfaRequirement(req: Request, res: Response, next: NextFunction) {
  // Skip MFA check for MFA-related endpoints
  if (req.path.startsWith('/api/mfa/')) {
    return next();
  }

  // Skip if no user is authenticated
  if (!req.user) {
    return next();
  }

  const context = {
    userId: req.user.id,
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
  };

  Promise.all([
    mfaService.isMfaEnabled(req.user.id),
    mfaService.isInGracePeriod(req.user.id),
    mfaService.isDeviceTrusted(req.user.id, context)
  ]).then(([mfaEnabled, inGracePeriod, deviceTrusted]) => {
    req.mfaRequired = mfaEnabled && !inGracePeriod && !deviceTrusted;
    req.deviceTrusted = deviceTrusted;
    req.mfaVerified = false; // Will be set by MFA verification endpoints

    // If MFA is required but not completed, return 403 with specific error
    if (req.mfaRequired && !req.mfaVerified) {
      return res.status(403).json({
        error: 'MFA verification required',
        mfaRequired: true,
        inGracePeriod,
        deviceTrusted,
      });
    }

    next();
  }).catch(error => {
    console.error('MFA check error:', error);
    res.status(500).json({ error: 'Failed to check MFA requirements' });
  });
}

/**
 * Middleware to require MFA completion for sensitive operations
 */
export function requireMfaVerification(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if MFA was recently verified in this session
  // In a real implementation, this would check session storage
  const mfaSessionKey = `mfa_verified_${req.user.id}`;
  const mfaVerifiedAt = req.session?.[mfaSessionKey];
  
  if (mfaVerifiedAt && Date.now() - mfaVerifiedAt < 5 * 60 * 1000) { // 5 minutes
    return next();
  }

  const context = {
    userId: req.user.id,
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
  };

  // Async function to handle MFA checks
  const checkMfaRequirement = async () => {
    const mfaEnabled = await mfaService.isMfaEnabled(req.user!.id);
    if (!mfaEnabled) {
      return next(); // MFA not enabled, proceed
    }

    const deviceTrusted = await mfaService.isDeviceTrusted(req.user!.id, context);
    if (deviceTrusted) {
      return next(); // Device is trusted, proceed
    }

    // Require MFA verification
    res.status(403).json({
      error: 'MFA verification required for this operation',
      mfaRequired: true,
    });
  };

  checkMfaRequirement().catch((error: any) => {
    console.error('MFA verification check error:', error);
    res.status(500).json({ error: 'Failed to check MFA verification' });
  });
}

/**
 * Middleware to mark MFA as verified in session
 */
export function markMfaVerified(req: Request, res: Response, next: NextFunction) {
  if (req.user && req.session) {
    const mfaSessionKey = `mfa_verified_${req.user.id}`;
    req.session[mfaSessionKey] = Date.now();
    req.mfaVerified = true;
  }
  next();
}

/**
 * Middleware for admin-only MFA operations
 */
export function requireMfaAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  next();
}