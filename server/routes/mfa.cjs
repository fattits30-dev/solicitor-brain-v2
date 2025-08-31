const express = require('express');
const { z } = require('zod');
const { authenticate } = require('../middleware/auth.cjs');
const MfaService = require('../services/mfa-simple.cjs');

const router = express.Router();
let mfaService;

// Initialize MFA service with database connection
function initializeMfaService(db) {
  mfaService = new MfaService(db);
}

// Setup TOTP
router.post('/setup/totp', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    
    const result = await mfaService.setupTotp(userId, email);
    
    res.json({
      success: true,
      qrCode: result.qrCode,
      manualEntry: result.manualEntry,
      backupCodes: result.backupCodes
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    res.status(500).json({ error: 'Failed to setup TOTP' });
  }
});

// Verify TOTP setup
router.post('/verify/totp-setup', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().length(6)
    });
    
    const { token } = schema.parse(req.body);
    const result = await mfaService.verifyTotpSetup(req.user.id, token);
    
    res.json(result);
  } catch (error) {
    console.error('TOTP setup verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Verify TOTP code
router.post('/verify/totp', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.number(),
      token: z.string().length(6)
    });
    
    const { userId, token } = schema.parse(req.body);
    const result = await mfaService.verifyTotp(userId, token);
    
    if (result.success) {
      const deviceFingerprint = mfaService.generateDeviceFingerprint(req);
      req.session = req.session || {};
      req.session.mfaVerified = true;
      req.session.deviceFingerprint = deviceFingerprint;
    }
    
    res.json(result);
  } catch (error) {
    console.error('TOTP verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Send SMS code
router.post('/send/sms', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      phoneNumber: z.string().regex(/^\+44\d{10}$/)
    });
    
    const { phoneNumber } = schema.parse(req.body);
    const result = await mfaService.sendSmsCode(req.user.id, phoneNumber);
    
    res.json(result);
  } catch (error) {
    console.error('SMS send error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Verify SMS code
router.post('/verify/sms', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.number(),
      code: z.string().length(6)
    });
    
    const { userId, code } = schema.parse(req.body);
    const result = await mfaService.verifySmsCode(userId, code);
    
    if (result.success) {
      req.session = req.session || {};
      req.session.mfaVerified = true;
    }
    
    res.json(result);
  } catch (error) {
    console.error('SMS verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Send email code
router.post('/send/email', authenticate, async (req, res) => {
  try {
    const result = await mfaService.sendEmailCode(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Email send error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Verify email code
router.post('/verify/email', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.number(),
      code: z.string().length(6)
    });
    
    const { userId, code } = schema.parse(req.body);
    const result = await mfaService.verifyEmailCode(userId, code);
    
    if (result.success) {
      req.session = req.session || {};
      req.session.mfaVerified = true;
    }
    
    res.json(result);
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Verify backup code
router.post('/verify/backup', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.number(),
      code: z.string().length(8)
    });
    
    const { userId, code } = schema.parse(req.body);
    const result = await mfaService.verifyBackupCode(userId, code);
    
    if (result.success) {
      req.session = req.session || {};
      req.session.mfaVerified = true;
    }
    
    res.json(result);
  } catch (error) {
    console.error('Backup code verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Trust device
router.post('/trust-device', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      deviceName: z.string().optional()
    });
    
    const { deviceName } = schema.parse(req.body);
    const deviceFingerprint = mfaService.generateDeviceFingerprint(req);
    
    const result = await mfaService.trustDevice(
      req.user.id,
      deviceFingerprint,
      deviceName
    );
    
    res.json(result);
  } catch (error) {
    console.error('Trust device error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get trusted devices
router.get('/trusted-devices', authenticate, async (req, res) => {
  try {
    const devices = await mfaService.getTrustedDevices(req.user.id);
    res.json({ devices });
  } catch (error) {
    console.error('Get trusted devices error:', error);
    res.status(500).json({ error: 'Failed to get trusted devices' });
  }
});

// Remove trusted device
router.delete('/trusted-devices/:deviceId', authenticate, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.deviceId);
    const result = await mfaService.removeTrustedDevice(req.user.id, deviceId);
    res.json(result);
  } catch (error) {
    console.error('Remove trusted device error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get MFA status
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await mfaService.getMfaStatus(req.user.id);
    res.json(status);
  } catch (error) {
    console.error('Get MFA status error:', error);
    res.status(500).json({ error: 'Failed to get MFA status' });
  }
});

// Generate new backup codes
router.post('/backup-codes/regenerate', authenticate, async (req, res) => {
  try {
    const codes = await mfaService.generateBackupCodes(req.user.id);
    res.json({ backupCodes: codes });
  } catch (error) {
    console.error('Generate backup codes error:', error);
    res.status(500).json({ error: 'Failed to generate backup codes' });
  }
});

// Disable MFA (admin only)
router.post('/disable', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const schema = z.object({
      userId: z.number()
    });
    
    const { userId } = schema.parse(req.body);
    const result = await mfaService.disableMfa(userId, req.user.id);
    
    res.json(result);
  } catch (error) {
    console.error('Disable MFA error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = { router, initializeMfaService };