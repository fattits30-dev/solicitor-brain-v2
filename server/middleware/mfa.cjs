const MfaService = require('../services/mfa-simple.cjs');

let mfaService;

function initializeMfaMiddleware(db) {
  mfaService = new MfaService(db);
}

async function requireMfa(req, res, next) {
  try {
    // Skip MFA for authentication endpoints
    if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/mfa/')) {
      return next();
    }

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if MFA is enabled for user
    const mfaStatus = await mfaService.getMfaStatus(req.user.id);
    
    if (!mfaStatus.enabled) {
      // Check if user is in grace period
      if (mfaStatus.inGracePeriod) {
        res.setHeader('X-MFA-Grace-Period', mfaStatus.gracePeriodEnd);
      }
      return next();
    }

    // Check if device is trusted
    const deviceFingerprint = mfaService.generateDeviceFingerprint(req);
    if (await mfaService.isDeviceTrusted(req.user.id, deviceFingerprint)) {
      return next();
    }

    // Check if MFA is already verified in session
    if (req.session && req.session.mfaVerified) {
      // Verify session device fingerprint matches
      if (req.session.deviceFingerprint === deviceFingerprint) {
        return next();
      }
    }

    // MFA required but not verified
    return res.status(403).json({ 
      error: 'MFA verification required',
      mfaRequired: true,
      methods: {
        totp: mfaStatus.hasTotp,
        sms: mfaStatus.hasSms,
        email: mfaStatus.hasEmail,
        backupCodes: mfaStatus.unusedBackupCodes > 0
      }
    });
  } catch (error) {
    console.error('MFA middleware error:', error);
    // Fail open in case of error, but log it
    next();
  }
}

async function checkMfaStatus(req, res, next) {
  try {
    if (!req.user) {
      return next();
    }

    const mfaStatus = await mfaService.getMfaStatus(req.user.id);
    
    // Add MFA status to response headers
    res.setHeader('X-MFA-Enabled', mfaStatus.enabled);
    
    if (mfaStatus.inGracePeriod) {
      res.setHeader('X-MFA-Grace-Period', mfaStatus.gracePeriodEnd);
    }
    
    // Add to request for use in controllers
    req.mfaStatus = mfaStatus;
    
    next();
  } catch (error) {
    console.error('MFA status check error:', error);
    next();
  }
}

module.exports = {
  requireMfa,
  checkMfaStatus,
  initializeMfaMiddleware
};