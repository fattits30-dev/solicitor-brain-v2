const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const encryptionService = require('./encryption.cjs');

class MfaService {
  constructor(db) {
    this.db = db; // PostgreSQL Pool
    this.encryption = encryptionService;
    this.appName = 'Solicitor Brain';
    this.gracePeriodDays = parseInt(process.env.MFA_GRACE_PERIOD_DAYS || '7');
    this.maxAttemptsPerHour = parseInt(process.env.MFA_MAX_ATTEMPTS_PER_HOUR || '5');
    this.trustedDeviceDays = parseInt(process.env.MFA_TRUSTED_DEVICE_DAYS || '30');
    this.backupCodesCount = parseInt(process.env.MFA_BACKUP_CODES_COUNT || '10');
  }

  async setupTotp(userId, email) {
    try {
      const secret = speakeasy.generateSecret({
        name: `${this.appName} (${email})`,
        issuer: this.appName,
        length: 32
      });

      const encryptedSecret = this.encryption.encrypt(secret.base32, 'mfa');
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
      const gracePeriodEnd = new Date(Date.now() + this.gracePeriodDays * 24 * 60 * 60 * 1000);

      // Upsert MFA settings
      await this.db.query(`
        INSERT INTO mfa_settings (user_id, totp_secret, email_address, is_enabled, grace_period_end)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE
        SET totp_secret = $2, email_address = $3, updated_at = NOW()
      `, [userId, encryptedSecret, email, false, gracePeriodEnd]);

      return {
        qrCode: qrCodeUrl,
        manualEntry: secret.base32,
        backupCodes: await this.generateBackupCodes(userId)
      };
    } catch (error) {
      console.error('MFA setup error:', error);
      throw new Error('Failed to setup MFA');
    }
  }

  async verifyTotpSetup(userId, token) {
    try {
      const result = await this.db.query(
        'SELECT * FROM mfa_settings WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (!result.rows.length) {
        throw new Error('MFA not initialized');
      }

      const settings = result.rows[0];
      const decryptedSecret = this.encryption.decrypt(settings.totp_secret, 'mfa');
      
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (verified) {
        await this.db.query(
          'UPDATE mfa_settings SET is_enabled = true, updated_at = NOW() WHERE user_id = $1',
          [userId]
        );
        await this.logAttempt(userId, 'totp_setup', true);
        return { success: true };
      }

      await this.logAttempt(userId, 'totp_setup', false);
      return { success: false, error: 'Invalid verification code' };
    } catch (error) {
      console.error('TOTP verification error:', error);
      throw new Error('Verification failed');
    }
  }

  async verifyTotp(userId, token) {
    try {
      if (!await this.checkRateLimit(userId)) {
        throw new Error('Too many attempts. Please try again later.');
      }

      const result = await this.db.query(
        'SELECT * FROM mfa_settings WHERE user_id = $1 AND is_enabled = true LIMIT 1',
        [userId]
      );

      if (!result.rows.length) {
        throw new Error('MFA not enabled');
      }

      const settings = result.rows[0];
      const decryptedSecret = this.encryption.decrypt(settings.totp_secret, 'mfa');
      
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: token,
        window: 1
      });

      await this.logAttempt(userId, 'totp', verified);
      return { success: verified };
    } catch (error) {
      console.error('TOTP verification error:', error);
      throw error;
    }
  }

  async generateBackupCodes(userId) {
    const codes = [];
    const values = [];

    // Delete existing codes
    await this.db.query('DELETE FROM mfa_recovery_codes WHERE user_id = $1', [userId]);

    for (let i = 0; i < this.backupCodesCount; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      values.push(`(${userId}, '${codeHash}', false)`);
    }

    // Insert new codes
    await this.db.query(`
      INSERT INTO mfa_recovery_codes (user_id, code_hash, used)
      VALUES ${values.join(',')}
    `);

    return codes;
  }

  async verifyBackupCode(userId, code) {
    try {
      if (!await this.checkRateLimit(userId)) {
        throw new Error('Too many attempts. Please try again later.');
      }

      const codeHash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
      
      const result = await this.db.query(
        'SELECT * FROM mfa_recovery_codes WHERE user_id = $1 AND code_hash = $2 AND used = false LIMIT 1',
        [userId, codeHash]
      );

      if (result.rows.length) {
        await this.db.query(
          'UPDATE mfa_recovery_codes SET used = true, used_at = NOW() WHERE id = $1',
          [result.rows[0].id]
        );
        await this.logAttempt(userId, 'backup_code', true);
        return { success: true };
      }

      await this.logAttempt(userId, 'backup_code', false);
      return { success: false, error: 'Invalid or used backup code' };
    } catch (error) {
      console.error('Backup code verification error:', error);
      throw error;
    }
  }

  async getMfaStatus(userId) {
    try {
      const result = await this.db.query(
        'SELECT * FROM mfa_settings WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (!result.rows.length) {
        return {
          enabled: false,
          hasTotp: false,
          hasSms: false,
          hasEmail: false,
          inGracePeriod: false
        };
      }

      const s = result.rows[0];
      const now = new Date();
      
      const backupCodesResult = await this.db.query(
        'SELECT COUNT(*) as count FROM mfa_recovery_codes WHERE user_id = $1 AND used = false',
        [userId]
      );

      const trustedDevicesResult = await this.db.query(
        'SELECT COUNT(*) as count FROM trusted_devices WHERE user_id = $1 AND expires_at > NOW()',
        [userId]
      );

      return {
        enabled: s.is_enabled,
        hasTotp: !!s.totp_secret,
        hasSms: !!s.sms_phone_number,
        hasEmail: !!s.email_address,
        inGracePeriod: s.grace_period_end && s.grace_period_end > now,
        gracePeriodEnd: s.grace_period_end,
        trustedDevicesCount: parseInt(trustedDevicesResult.rows[0].count),
        unusedBackupCodes: parseInt(backupCodesResult.rows[0].count)
      };
    } catch (error) {
      console.error('Get MFA status error:', error);
      throw error;
    }
  }

  async trustDevice(userId, deviceFingerprint, deviceName = null) {
    try {
      const expiresAt = new Date(Date.now() + this.trustedDeviceDays * 24 * 60 * 60 * 1000);
      
      await this.db.query(
        'INSERT INTO trusted_devices (user_id, device_fingerprint, device_name, expires_at) VALUES ($1, $2, $3, $4)',
        [userId, deviceFingerprint, deviceName, expiresAt]
      );

      return { success: true, expiresAt };
    } catch (error) {
      console.error('Trust device error:', error);
      throw error;
    }
  }

  async isDeviceTrusted(userId, deviceFingerprint) {
    try {
      const result = await this.db.query(
        'SELECT * FROM trusted_devices WHERE user_id = $1 AND device_fingerprint = $2 AND expires_at > NOW() LIMIT 1',
        [userId, deviceFingerprint]
      );

      if (result.rows.length) {
        await this.db.query(
          'UPDATE trusted_devices SET last_used = NOW() WHERE id = $1',
          [result.rows[0].id]
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('Device trust check error:', error);
      return false;
    }
  }

  async removeTrustedDevice(userId, deviceId) {
    try {
      await this.db.query(
        'DELETE FROM trusted_devices WHERE id = $1 AND user_id = $2',
        [deviceId, userId]
      );
      return { success: true };
    } catch (error) {
      console.error('Remove trusted device error:', error);
      throw error;
    }
  }

  async getTrustedDevices(userId) {
    try {
      const result = await this.db.query(
        'SELECT * FROM trusted_devices WHERE user_id = $1 AND expires_at > NOW() ORDER BY last_used DESC',
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Get trusted devices error:', error);
      throw error;
    }
  }

  async checkRateLimit(userId) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const result = await this.db.query(
        'SELECT COUNT(*) as count FROM mfa_attempts WHERE user_id = $1 AND attempted_at > $2 AND success = false',
        [userId, oneHourAgo]
      );

      return parseInt(result.rows[0].count) < this.maxAttemptsPerHour;
    } catch (error) {
      console.error('Rate limit check error:', error);
      return true;
    }
  }

  async logAttempt(userId, method, success, ipAddress = null, userAgent = null) {
    try {
      await this.db.query(
        'INSERT INTO mfa_attempts (user_id, method, success, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [userId, method, success, ipAddress, userAgent]
      );
    } catch (error) {
      console.error('Log attempt error:', error);
    }
  }

  async disableMfa(userId, adminId = null) {
    try {
      await this.db.query(
        'UPDATE mfa_settings SET is_enabled = false, totp_secret = null, sms_phone_number = null, updated_at = NOW() WHERE user_id = $1',
        [userId]
      );

      await this.db.query('DELETE FROM mfa_recovery_codes WHERE user_id = $1', [userId]);
      await this.db.query('DELETE FROM trusted_devices WHERE user_id = $1', [userId]);

      if (adminId) {
        await this.logAttempt(userId, 'admin_disable', true, null, `Admin: ${adminId}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Disable MFA error:', error);
      throw error;
    }
  }

  generateDeviceFingerprint(req) {
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    const fingerprint = `${userAgent}|${ip}|${acceptLanguage}|${acceptEncoding}`;
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
  }

  // Stub methods for SMS and Email - would need actual integration
  async sendSmsCode(userId, phoneNumber) {
    console.log(`SMS functionality not yet implemented for ${phoneNumber}`);
    return { success: false, error: 'SMS not configured' };
  }

  async verifySmsCode(userId, code) {
    return { success: false, error: 'SMS not configured' };
  }

  async sendEmailCode(userId) {
    console.log(`Email MFA functionality not yet implemented`);
    return { success: false, error: 'Email MFA not configured' };
  }

  async verifyEmailCode(userId, code) {
    return { success: false, error: 'Email MFA not configured' };
  }

  async isInGracePeriod(userId) {
    try {
      const result = await this.db.query(
        'SELECT grace_period_end FROM mfa_settings WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (!result.rows.length) {
        return false;
      }

      return result.rows[0].grace_period_end && result.rows[0].grace_period_end > new Date();
    } catch (error) {
      console.error('Grace period check error:', error);
      return false;
    }
  }
}

module.exports = MfaService;