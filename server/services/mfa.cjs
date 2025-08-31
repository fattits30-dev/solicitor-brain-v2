const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { drizzle } = require('drizzle-orm');
const { eq, and, gt, desc } = require('drizzle-orm');
const EncryptionService = require('./encryption.js');

class MfaService {
  constructor(db) {
    this.db = db;
    this.encryption = new EncryptionService();
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

      await this.db.insert('mfa_settings').values({
        user_id: userId,
        totp_secret: encryptedSecret,
        email_address: email,
        is_enabled: false,
        grace_period_end: new Date(Date.now() + this.gracePeriodDays * 24 * 60 * 60 * 1000)
      }).onConflictDoUpdate({
        target: 'user_id',
        set: {
          totp_secret: encryptedSecret,
          email_address: email,
          updated_at: new Date()
        }
      });

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
      const settings = await this.db.select()
        .from('mfa_settings')
        .where(eq('user_id', userId))
        .limit(1);

      if (!settings.length) {
        throw new Error('MFA not initialized');
      }

      const decryptedSecret = this.encryption.decrypt(settings[0].totp_secret, 'mfa');
      
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (verified) {
        await this.db.update('mfa_settings')
          .set({ 
            is_enabled: true, 
            updated_at: new Date() 
          })
          .where(eq('user_id', userId));

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

      const settings = await this.db.select()
        .from('mfa_settings')
        .where(and(
          eq('user_id', userId),
          eq('is_enabled', true)
        ))
        .limit(1);

      if (!settings.length) {
        throw new Error('MFA not enabled');
      }

      const decryptedSecret = this.encryption.decrypt(settings[0].totp_secret, 'mfa');
      
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
    const hashedCodes = [];

    for (let i = 0; i < this.backupCodesCount; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
      hashedCodes.push({
        user_id: userId,
        code_hash: crypto.createHash('sha256').update(code).digest('hex'),
        used: false
      });
    }

    await this.db.delete('mfa_recovery_codes')
      .where(eq('user_id', userId));

    await this.db.insert('mfa_recovery_codes')
      .values(hashedCodes);

    return codes;
  }

  async verifyBackupCode(userId, code) {
    try {
      if (!await this.checkRateLimit(userId)) {
        throw new Error('Too many attempts. Please try again later.');
      }

      const codeHash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
      
      const recovery = await this.db.select()
        .from('mfa_recovery_codes')
        .where(and(
          eq('user_id', userId),
          eq('code_hash', codeHash),
          eq('used', false)
        ))
        .limit(1);

      if (recovery.length) {
        await this.db.update('mfa_recovery_codes')
          .set({ 
            used: true, 
            used_at: new Date() 
          })
          .where(eq('id', recovery[0].id));

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

  async sendSmsCode(userId, phoneNumber) {
    try {
      if (!process.env.TWILIO_ACCOUNT_SID) {
        throw new Error('SMS service not configured');
      }

      const code = crypto.randomInt(100000, 999999).toString();
      const encryptedCode = this.encryption.encrypt(code, 'mfa');
      
      await this.db.update('mfa_settings')
        .set({ 
          sms_phone_number: phoneNumber,
          sms_code: encryptedCode,
          sms_code_expires: new Date(Date.now() + 10 * 60 * 1000),
          updated_at: new Date()
        })
        .where(eq('user_id', userId));

      // Twilio integration would go here
      console.log(`SMS code for ${phoneNumber}: ${code}`);
      
      return { success: true, message: 'SMS code sent' };
    } catch (error) {
      console.error('SMS send error:', error);
      throw error;
    }
  }

  async verifySmsCode(userId, code) {
    try {
      if (!await this.checkRateLimit(userId)) {
        throw new Error('Too many attempts. Please try again later.');
      }

      const settings = await this.db.select()
        .from('mfa_settings')
        .where(eq('user_id', userId))
        .limit(1);

      if (!settings.length || !settings[0].sms_code) {
        throw new Error('No SMS code pending');
      }

      if (new Date() > settings[0].sms_code_expires) {
        throw new Error('SMS code expired');
      }

      const decryptedCode = this.encryption.decrypt(settings[0].sms_code, 'mfa');
      const verified = code === decryptedCode;

      if (verified) {
        await this.db.update('mfa_settings')
          .set({ 
            sms_code: null,
            sms_code_expires: null,
            updated_at: new Date()
          })
          .where(eq('user_id', userId));
      }

      await this.logAttempt(userId, 'sms', verified);
      return { success: verified };
    } catch (error) {
      console.error('SMS verification error:', error);
      throw error;
    }
  }

  async sendEmailCode(userId) {
    try {
      const settings = await this.db.select()
        .from('mfa_settings')
        .where(eq('user_id', userId))
        .limit(1);

      if (!settings.length || !settings[0].email_address) {
        throw new Error('Email not configured');
      }

      const code = crypto.randomInt(100000, 999999).toString();
      const encryptedCode = this.encryption.encrypt(code, 'mfa');
      
      await this.db.update('mfa_settings')
        .set({ 
          email_code: encryptedCode,
          email_code_expires: new Date(Date.now() + 10 * 60 * 1000),
          updated_at: new Date()
        })
        .where(eq('user_id', userId));

      // Email service integration would go here
      console.log(`Email code for ${settings[0].email_address}: ${code}`);
      
      return { success: true, message: 'Email code sent' };
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  }

  async verifyEmailCode(userId, code) {
    try {
      if (!await this.checkRateLimit(userId)) {
        throw new Error('Too many attempts. Please try again later.');
      }

      const settings = await this.db.select()
        .from('mfa_settings')
        .where(eq('user_id', userId))
        .limit(1);

      if (!settings.length || !settings[0].email_code) {
        throw new Error('No email code pending');
      }

      if (new Date() > settings[0].email_code_expires) {
        throw new Error('Email code expired');
      }

      const decryptedCode = this.encryption.decrypt(settings[0].email_code, 'mfa');
      const verified = code === decryptedCode;

      if (verified) {
        await this.db.update('mfa_settings')
          .set({ 
            email_code: null,
            email_code_expires: null,
            updated_at: new Date()
          })
          .where(eq('user_id', userId));
      }

      await this.logAttempt(userId, 'email', verified);
      return { success: verified };
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  async trustDevice(userId, deviceFingerprint, deviceName = null) {
    try {
      const expiresAt = new Date(Date.now() + this.trustedDeviceDays * 24 * 60 * 60 * 1000);
      
      await this.db.insert('trusted_devices')
        .values({
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          device_name: deviceName,
          expires_at: expiresAt
        });

      return { success: true, expiresAt };
    } catch (error) {
      console.error('Trust device error:', error);
      throw error;
    }
  }

  async isDeviceTrusted(userId, deviceFingerprint) {
    try {
      const devices = await this.db.select()
        .from('trusted_devices')
        .where(and(
          eq('user_id', userId),
          eq('device_fingerprint', deviceFingerprint),
          gt('expires_at', new Date())
        ))
        .limit(1);

      if (devices.length) {
        await this.db.update('trusted_devices')
          .set({ last_used: new Date() })
          .where(eq('id', devices[0].id));
        
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
      await this.db.delete('trusted_devices')
        .where(and(
          eq('id', deviceId),
          eq('user_id', userId)
        ));

      return { success: true };
    } catch (error) {
      console.error('Remove trusted device error:', error);
      throw error;
    }
  }

  async getTrustedDevices(userId) {
    try {
      return await this.db.select()
        .from('trusted_devices')
        .where(and(
          eq('user_id', userId),
          gt('expires_at', new Date())
        ))
        .orderBy(desc('last_used'));
    } catch (error) {
      console.error('Get trusted devices error:', error);
      throw error;
    }
  }

  async getMfaStatus(userId) {
    try {
      const settings = await this.db.select()
        .from('mfa_settings')
        .where(eq('user_id', userId))
        .limit(1);

      if (!settings.length) {
        return {
          enabled: false,
          hasTotp: false,
          hasSms: false,
          hasEmail: false,
          inGracePeriod: false
        };
      }

      const s = settings[0];
      const now = new Date();
      
      return {
        enabled: s.is_enabled,
        hasTotp: !!s.totp_secret,
        hasSms: !!s.sms_phone_number,
        hasEmail: !!s.email_address,
        inGracePeriod: s.grace_period_end && s.grace_period_end > now,
        gracePeriodEnd: s.grace_period_end,
        trustedDevicesCount: await this.getTrustedDeviceCount(userId),
        unusedBackupCodes: await this.getUnusedBackupCodeCount(userId)
      };
    } catch (error) {
      console.error('Get MFA status error:', error);
      throw error;
    }
  }

  async isInGracePeriod(userId) {
    try {
      const settings = await this.db.select()
        .from('mfa_settings')
        .where(eq('user_id', userId))
        .limit(1);

      if (!settings.length) {
        return false;
      }

      return settings[0].grace_period_end && settings[0].grace_period_end > new Date();
    } catch (error) {
      console.error('Grace period check error:', error);
      return false;
    }
  }

  async checkRateLimit(userId) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const attempts = await this.db.select()
        .from('mfa_attempts')
        .where(and(
          eq('user_id', userId),
          gt('attempted_at', oneHourAgo),
          eq('success', false)
        ));

      return attempts.length < this.maxAttemptsPerHour;
    } catch (error) {
      console.error('Rate limit check error:', error);
      return true;
    }
  }

  async logAttempt(userId, method, success, ipAddress = null, userAgent = null) {
    try {
      await this.db.insert('mfa_attempts')
        .values({
          user_id: userId,
          method: method,
          success: success,
          ip_address: ipAddress,
          user_agent: userAgent
        });
    } catch (error) {
      console.error('Log attempt error:', error);
    }
  }

  async getTrustedDeviceCount(userId) {
    try {
      const devices = await this.db.select()
        .from('trusted_devices')
        .where(and(
          eq('user_id', userId),
          gt('expires_at', new Date())
        ));
      return devices.length;
    } catch (error) {
      return 0;
    }
  }

  async getUnusedBackupCodeCount(userId) {
    try {
      const codes = await this.db.select()
        .from('mfa_recovery_codes')
        .where(and(
          eq('user_id', userId),
          eq('used', false)
        ));
      return codes.length;
    } catch (error) {
      return 0;
    }
  }

  async disableMfa(userId, adminId = null) {
    try {
      await this.db.update('mfa_settings')
        .set({ 
          is_enabled: false,
          totp_secret: null,
          sms_phone_number: null,
          updated_at: new Date()
        })
        .where(eq('user_id', userId));

      await this.db.delete('mfa_recovery_codes')
        .where(eq('user_id', userId));

      await this.db.delete('trusted_devices')
        .where(eq('user_id', userId));

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
}

module.exports = MfaService;