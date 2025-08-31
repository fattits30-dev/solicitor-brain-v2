import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { mfaService, type VerificationContext, type TrustedDeviceOptions } from '../services/mfa';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Rate limiting for MFA operations
const mfaRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many MFA attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictMfaRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: { error: 'Too many verification attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const setupTotpSchema = z.object({
  email: z.string().email(),
});

const verifyTotpSchema = z.object({
  token: z.string().length(6).regex(/^\d+$/),
});

const setupSmsSchema = z.object({
  phoneNumber: z.string().regex(/^(\+44|0)[1-9]\d{8,9}$/, 'Invalid UK phone number'),
});

const verifyCodeSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

const verifyBackupCodeSchema = z.object({
  code: z.string().length(8).regex(/^[A-Z0-9]+$/),
});

const trustedDeviceSchema = z.object({
  deviceName: z.string().min(1).max(100).optional(),
  expirationDays: z.number().min(1).max(365).optional(),
});

// Helper function to get verification context
function getVerificationContext(req: Request): VerificationContext {
  return {
    userId: req.user!.id,
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
  };
}

/**
 * Get MFA status
 * GET /api/mfa/status
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = await mfaService.getMfaStatus(userId);
    const context = getVerificationContext(req);
    const isDeviceTrusted = await mfaService.isDeviceTrusted(userId, context);

    res.json({
      ...status,
      deviceTrusted: isDeviceTrusted,
    });
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({ error: 'Failed to get MFA status' });
  }
});

/**
 * Setup TOTP
 * POST /api/mfa/setup/totp
 */
router.post('/setup/totp', requireAuth, mfaRateLimit, async (req: Request, res: Response) => {
  try {
    const { email } = setupTotpSchema.parse(req.body);
    const userId = req.user!.id;

    const setup = await mfaService.setupTotp(userId, email);
    
    res.json({
      secret: setup.secret,
      qrCode: setup.qrCode,
      backupCodes: setup.backupCodes,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('TOTP setup error:', error);
    res.status(500).json({ error: 'Failed to setup TOTP' });
  }
});

/**
 * Verify TOTP setup
 * POST /api/mfa/setup/totp/verify
 */
router.post('/setup/totp/verify', requireAuth, strictMfaRateLimit, async (req: Request, res: Response) => {
  try {
    const { token } = verifyTotpSchema.parse(req.body);
    const userId = req.user!.id;
    const context = getVerificationContext(req);

    const verified = await mfaService.verifyTotpSetup(userId, token, context);
    
    if (verified) {
      res.json({ success: true, message: 'TOTP setup completed successfully' });
    } else {
      res.status(400).json({ error: 'Invalid verification code' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('TOTP verification error:', error);
    res.status(500).json({ error: 'Failed to verify TOTP' });
  }
});

/**
 * Verify TOTP token
 * POST /api/mfa/verify/totp
 */
router.post('/verify/totp', requireAuth, strictMfaRateLimit, async (req: Request, res: Response) => {
  try {
    const { token } = verifyTotpSchema.parse(req.body);
    const userId = req.user!.id;
    const context = getVerificationContext(req);

    const verified = await mfaService.verifyTotp(userId, token, context);
    
    if (verified) {
      res.json({ success: true, message: 'TOTP verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid verification code' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('TOTP verification error:', error);
    res.status(500).json({ error: 'Failed to verify TOTP' });
  }
});

/**
 * Send SMS code
 * POST /api/mfa/send/sms
 */
router.post('/send/sms', requireAuth, mfaRateLimit, async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = setupSmsSchema.parse(req.body);
    const userId = req.user!.id;

    const sent = await mfaService.sendSmsCode(userId, phoneNumber);
    
    if (sent) {
      res.json({ success: true, message: 'SMS code sent successfully' });
    } else {
      res.status(429).json({ error: 'Rate limit exceeded' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('SMS send error:', error);
    res.status(500).json({ error: 'Failed to send SMS code' });
  }
});

/**
 * Verify SMS code
 * POST /api/mfa/verify/sms
 */
router.post('/verify/sms', requireAuth, strictMfaRateLimit, async (req: Request, res: Response) => {
  try {
    const { code } = verifyCodeSchema.parse(req.body);
    const userId = req.user!.id;
    const context = getVerificationContext(req);

    const verified = await mfaService.verifySmsCode(userId, code, context);
    
    if (verified) {
      res.json({ success: true, message: 'SMS code verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid or expired verification code' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('SMS verification error:', error);
    res.status(500).json({ error: 'Failed to verify SMS code' });
  }
});

/**
 * Send email code
 * POST /api/mfa/send/email
 */
router.post('/send/email', requireAuth, mfaRateLimit, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const sent = await mfaService.sendEmailCode(userId);
    
    if (sent) {
      res.json({ success: true, message: 'Email code sent successfully' });
    } else {
      res.status(429).json({ error: 'Rate limit exceeded or email not configured' });
    }
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email code' });
  }
});

/**
 * Verify email code
 * POST /api/mfa/verify/email
 */
router.post('/verify/email', requireAuth, strictMfaRateLimit, async (req: Request, res: Response) => {
  try {
    const { code } = verifyCodeSchema.parse(req.body);
    const userId = req.user!.id;
    const context = getVerificationContext(req);

    const verified = await mfaService.verifyEmailCode(userId, code, context);
    
    if (verified) {
      res.json({ success: true, message: 'Email code verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid or expired verification code' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email code' });
  }
});

/**
 * Verify backup code
 * POST /api/mfa/verify/backup
 */
router.post('/verify/backup', requireAuth, strictMfaRateLimit, async (req: Request, res: Response) => {
  try {
    const { code } = verifyBackupCodeSchema.parse(req.body);
    const userId = req.user!.id;
    const context = getVerificationContext(req);

    const verified = await mfaService.verifyBackupCode(userId, code, context);
    
    if (verified) {
      res.json({ success: true, message: 'Backup code verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid or already used backup code' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Backup code verification error:', error);
    res.status(500).json({ error: 'Failed to verify backup code' });
  }
});

/**
 * Add trusted device
 * POST /api/mfa/trusted-devices
 */
router.post('/trusted-devices', requireAuth, async (req: Request, res: Response) => {
  try {
    const options: TrustedDeviceOptions = trustedDeviceSchema.parse(req.body);
    const userId = req.user!.id;
    const context = getVerificationContext(req);

    const deviceFingerprint = await mfaService.addTrustedDevice(userId, context, options);
    
    res.json({ 
      success: true, 
      message: 'Device added as trusted',
      deviceFingerprint,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Add trusted device error:', error);
    res.status(500).json({ error: 'Failed to add trusted device' });
  }
});

/**
 * Get trusted devices
 * GET /api/mfa/trusted-devices
 */
router.get('/trusted-devices', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const devices = await mfaService.getTrustedDevices(userId);
    
    res.json({ devices });
  } catch (error) {
    console.error('Get trusted devices error:', error);
    res.status(500).json({ error: 'Failed to get trusted devices' });
  }
});

/**
 * Remove trusted device
 * DELETE /api/mfa/trusted-devices/:deviceId
 */
router.delete('/trusted-devices/:deviceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user!.id;

    const removed = await mfaService.removeTrustedDevice(userId, deviceId);
    
    if (removed) {
      res.json({ success: true, message: 'Trusted device removed' });
    } else {
      res.status(404).json({ error: 'Trusted device not found' });
    }
  } catch (error) {
    console.error('Remove trusted device error:', error);
    res.status(500).json({ error: 'Failed to remove trusted device' });
  }
});

/**
 * Generate new backup codes
 * POST /api/mfa/backup-codes/regenerate
 */
router.post('/backup-codes/regenerate', requireAuth, mfaRateLimit, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const backupCodes = await mfaService.generateNewBackupCodes(userId);
    
    res.json({ 
      success: true, 
      message: 'New backup codes generated',
      backupCodes,
    });
  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({ error: 'Failed to generate new backup codes' });
  }
});

/**
 * Disable MFA (requires admin privileges or additional verification)
 * POST /api/mfa/disable
 */
router.post('/disable', requireAuth, strictMfaRateLimit, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const adminUserId = req.user!.id; // In real implementation, check for admin role

    // In production, this should require additional verification
    // such as entering current password or backup code
    await mfaService.disableMfa(userId, adminUserId);
    
    res.json({ success: true, message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('Disable MFA error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

/**
 * Check if device is trusted
 * GET /api/mfa/device/trusted
 */
router.get('/device/trusted', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const context = getVerificationContext(req);

    const trusted = await mfaService.isDeviceTrusted(userId, context);
    
    res.json({ trusted });
  } catch (error) {
    console.error('Check trusted device error:', error);
    res.status(500).json({ error: 'Failed to check device trust status' });
  }
});

/**
 * Complete MFA verification (used after successful verification)
 * POST /api/mfa/complete
 */
router.post('/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Check if MFA is enabled and user is authenticated
    const mfaEnabled = await mfaService.isMfaEnabled(userId);
    
    if (!mfaEnabled) {
      return res.status(400).json({ error: 'MFA not enabled for this user' });
    }

    // In a real implementation, you would:
    // 1. Verify that MFA was just completed successfully
    // 2. Set session flags indicating MFA completion
    // 3. Update user session with MFA completion timestamp
    
    // For now, just return success
    res.json({ 
      success: true, 
      message: 'MFA verification completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Complete MFA error:', error);
    res.status(500).json({ error: 'Failed to complete MFA verification' });
  }
});

export default router;