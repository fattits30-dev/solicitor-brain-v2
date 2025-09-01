import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { db } from '../db';
import { 
  mfaSettings, 
  trustedDevices, 
  mfaAttempts, 
  mfaRecoveryCodes,
  auditLog,
  type MfaSettings,
  type InsertMfaSettings,
  type InsertTrustedDevice,
  type InsertMfaAttempt,
  type InsertMfaRecoveryCode,
  type InsertAuditLog
} from '@shared/schema';
import { encrypt, decrypt, hashData, generateSecureCode, generateDeviceFingerprint } from './crypto';
import { eq, and, gte, lt, count } from 'drizzle-orm';

// Configuration from environment
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
};

const MFA_CONFIG = {
  appName: 'Solicitor Brain',
  gracePeriodDays: parseInt(process.env.MFA_GRACE_PERIOD_DAYS || '7'),
  maxAttemptsPerHour: parseInt(process.env.MFA_MAX_ATTEMPTS_PER_HOUR || '5'),
  trustedDeviceDays: parseInt(process.env.MFA_TRUSTED_DEVICE_DAYS || '30'),
  backupCodesCount: parseInt(process.env.MFA_BACKUP_CODES_COUNT || '10'),
};

// Initialize services
let emailTransporter: nodemailer.Transporter | null = null;
let twilioClient: twilio.Twilio | null = null;

if (EMAIL_CONFIG.host && EMAIL_CONFIG.auth.user) {
  emailTransporter = nodemailer.createTransport(EMAIL_CONFIG);
}

if (TWILIO_CONFIG.accountSid && TWILIO_CONFIG.authToken) {
  twilioClient = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);
}

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface VerificationContext {
  userId: string;
  ipAddress: string;
  userAgent: string;
}

export interface TrustedDeviceOptions {
  deviceName?: string;
  expirationDays?: number;
}

/**
 * MFA Service for handling all Multi-Factor Authentication operations
 */
export class MfaService {
  /**
   * Check if MFA is enabled for a user
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const settings = await db.select()
      .from(mfaSettings)
      .where(eq(mfaSettings.userId, userId))
      .limit(1);

    return settings.length > 0 && settings[0].isEnabled;
  }

  /**
   * Check if user is in MFA grace period
   */
  async isInGracePeriod(userId: string): Promise<boolean> {
    const settings = await db.select()
      .from(mfaSettings)
      .where(eq(mfaSettings.userId, userId))
      .limit(1);

    if (settings.length === 0) return false;

    const gracePeriodEnd = settings[0].gracePeriodEnd;
    if (!gracePeriodEnd) return false;

    return new Date() < gracePeriodEnd;
  }

  /**
   * Setup TOTP for a user
   */
  async setupTotp(userId: string, userEmail: string): Promise<MfaSetupResponse> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: MFA_CONFIG.appName,
      length: 32,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = Array.from({ length: MFA_CONFIG.backupCodesCount }, () => 
      generateSecureCode(8)
    );

    // Encrypt sensitive data
    const encryptedSecret = encrypt(secret.base32!);
    const encryptedBackupCodes = backupCodes.map(code => encrypt(code));
    const encryptedEmail = encrypt(userEmail);

    // Calculate grace period end
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + MFA_CONFIG.gracePeriodDays);

    // Store in database
    await db.insert(mfaSettings).values({
      userId,
      isEnabled: false, // Will be enabled after verification
      totpSecret: JSON.stringify(encryptedSecret),
      backupCodes: JSON.stringify(encryptedBackupCodes),
      emailAddress: JSON.stringify(encryptedEmail),
      gracePeriodEnd,
    }).onConflictDoUpdate({
      target: mfaSettings.userId,
      set: {
        totpSecret: JSON.stringify(encryptedSecret),
        backupCodes: JSON.stringify(encryptedBackupCodes),
        emailAddress: JSON.stringify(encryptedEmail),
        gracePeriodEnd,
        updatedAt: new Date(),
      },
    });

    // Store backup codes separately for tracking usage
    const recoveryCodeInserts: InsertMfaRecoveryCode[] = backupCodes.map(code => ({
      userId,
      codeHash: hashData(code),
      used: false,
    }));

    // Clear existing recovery codes and insert new ones
    await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
    await db.insert(mfaRecoveryCodes).values(recoveryCodeInserts);

    // Log setup attempt
    await this.logMfaEvent(userId, 'mfa_setup_initiated', true, '', '');

    return {
      secret: secret.base32!,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Verify TOTP setup and enable MFA
   */
  async verifyTotpSetup(userId: string, token: string, context: VerificationContext): Promise<boolean> {
    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.totpSecret) {
      await this.logMfaEvent(userId, 'totp', false, context.ipAddress, context.userAgent);
      return false;
    }

    const encryptedSecret = JSON.parse(settings.totpSecret);
    const secret = decrypt(encryptedSecret);

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after current
    });

    if (verified) {
      // Enable MFA
      await db.update(mfaSettings)
        .set({ 
          isEnabled: true, 
          updatedAt: new Date(),
          gracePeriodEnd: null, // Remove grace period
        })
        .where(eq(mfaSettings.userId, userId));

      await this.logMfaEvent(userId, 'totp_setup_completed', true, context.ipAddress, context.userAgent);
    } else {
      await this.logMfaEvent(userId, 'totp_setup_failed', false, context.ipAddress, context.userAgent);
    }

    return verified;
  }

  /**
   * Verify TOTP token
   */
  async verifyTotp(userId: string, token: string, context: VerificationContext): Promise<boolean> {
    if (await this.isRateLimited(userId)) {
      await this.logMfaEvent(userId, 'totp', false, context.ipAddress, context.userAgent);
      return false;
    }

    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.totpSecret || !settings.isEnabled) {
      await this.logMfaEvent(userId, 'totp', false, context.ipAddress, context.userAgent);
      return false;
    }

    const encryptedSecret = JSON.parse(settings.totpSecret);
    const secret = decrypt(encryptedSecret);

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Stricter window for actual verification
    });

    await this.logMfaEvent(userId, 'totp', verified, context.ipAddress, context.userAgent);
    return verified;
  }

  /**
   * Send SMS verification code
   */
  async sendSmsCode(userId: string, phoneNumber: string): Promise<boolean> {
    if (!twilioClient) {
      throw new Error('SMS service not configured');
    }

    if (await this.isRateLimited(userId)) {
      return false;
    }

    // Validate UK phone number format
    const ukPhoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;
    if (!ukPhoneRegex.test(phoneNumber)) {
      throw new Error('Invalid UK phone number format');
    }

    // Generate and store code (expires in 10 minutes)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store encrypted phone number and code
    const encryptedPhone = encrypt(phoneNumber);
    const encryptedCode = encrypt(code);

    await db.update(mfaSettings)
      .set({
        smsPhoneNumber: JSON.stringify({
          ...encryptedPhone,
          code: encryptedCode,
          expiresAt: expiresAt.toISOString(),
        }),
        updatedAt: new Date(),
      })
      .where(eq(mfaSettings.userId, userId));

    // Send SMS
    try {
      await twilioClient.messages.create({
        body: `Your Solicitor Brain verification code is: ${code}. This code expires in 10 minutes.`,
        from: TWILIO_CONFIG.phoneNumber,
        to: phoneNumber,
      });

      await this.logMfaEvent(userId, 'sms_sent', true, '', '');
      return true;
    } catch (error) {
      await this.logMfaEvent(userId, 'sms_send_failed', false, '', '');
      throw error;
    }
  }

  /**
   * Verify SMS code
   */
  async verifySmsCode(userId: string, code: string, context: VerificationContext): Promise<boolean> {
    if (await this.isRateLimited(userId)) {
      await this.logMfaEvent(userId, 'sms', false, context.ipAddress, context.userAgent);
      return false;
    }

    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.smsPhoneNumber) {
      await this.logMfaEvent(userId, 'sms', false, context.ipAddress, context.userAgent);
      return false;
    }

    const smsData = JSON.parse(settings.smsPhoneNumber);
    
    // Check if code has expired
    if (new Date() > new Date(smsData.expiresAt)) {
      await this.logMfaEvent(userId, 'sms', false, context.ipAddress, context.userAgent);
      return false;
    }

    const storedCode = decrypt(smsData.code);
    const verified = code === storedCode;

    if (verified) {
      // Clear the used code
      await db.update(mfaSettings)
        .set({
          smsPhoneNumber: JSON.stringify({
            iv: smsData.iv,
            tag: smsData.tag,
            data: smsData.data,
          }),
          updatedAt: new Date(),
        })
        .where(eq(mfaSettings.userId, userId));
    }

    await this.logMfaEvent(userId, 'sms', verified, context.ipAddress, context.userAgent);
    return verified;
  }

  /**
   * Send email verification code
   */
  async sendEmailCode(userId: string): Promise<boolean> {
    if (!emailTransporter) {
      throw new Error('Email service not configured');
    }

    if (await this.isRateLimited(userId)) {
      return false;
    }

    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.emailAddress) {
      return false;
    }

    const encryptedEmail = JSON.parse(settings.emailAddress);
    const email = decrypt(encryptedEmail);

    // Generate and store code (expires in 10 minutes)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const encryptedCode = encrypt(code);

    await db.update(mfaSettings)
      .set({
        emailAddress: JSON.stringify({
          ...encryptedEmail,
          code: encryptedCode,
          expiresAt: expiresAt.toISOString(),
        }),
        updatedAt: new Date(),
      })
      .where(eq(mfaSettings.userId, userId));

    // Send email
    try {
      await emailTransporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: 'Solicitor Brain - Verification Code',
        html: `
          <h2>Verification Code</h2>
          <p>Your verification code is: <strong>${code}</strong></p>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this code, please contact support immediately.</p>
        `,
      });

      await this.logMfaEvent(userId, 'email_sent', true, '', '');
      return true;
    } catch (error) {
      await this.logMfaEvent(userId, 'email_send_failed', false, '', '');
      throw error;
    }
  }

  /**
   * Verify email code
   */
  async verifyEmailCode(userId: string, code: string, context: VerificationContext): Promise<boolean> {
    if (await this.isRateLimited(userId)) {
      await this.logMfaEvent(userId, 'email', false, context.ipAddress, context.userAgent);
      return false;
    }

    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.emailAddress) {
      await this.logMfaEvent(userId, 'email', false, context.ipAddress, context.userAgent);
      return false;
    }

    const emailData = JSON.parse(settings.emailAddress);
    
    if (!emailData.code || !emailData.expiresAt) {
      await this.logMfaEvent(userId, 'email', false, context.ipAddress, context.userAgent);
      return false;
    }

    // Check if code has expired
    if (new Date() > new Date(emailData.expiresAt)) {
      await this.logMfaEvent(userId, 'email', false, context.ipAddress, context.userAgent);
      return false;
    }

    const storedCode = decrypt(emailData.code);
    const verified = code === storedCode;

    if (verified) {
      // Clear the used code
      const { code: _, expiresAt: __, ...cleanEmailData } = emailData;
      await db.update(mfaSettings)
        .set({
          emailAddress: JSON.stringify(cleanEmailData),
          updatedAt: new Date(),
        })
        .where(eq(mfaSettings.userId, userId));
    }

    await this.logMfaEvent(userId, 'email', verified, context.ipAddress, context.userAgent);
    return verified;
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string, context: VerificationContext): Promise<boolean> {
    if (await this.isRateLimited(userId)) {
      await this.logMfaEvent(userId, 'backup', false, context.ipAddress, context.userAgent);
      return false;
    }

    const codeHash = hashData(code);
    
    // Find unused backup code
    const recoveryCode = await db.select()
      .from(mfaRecoveryCodes)
      .where(and(
        eq(mfaRecoveryCodes.userId, userId),
        eq(mfaRecoveryCodes.codeHash, codeHash),
        eq(mfaRecoveryCodes.used, false)
      ))
      .limit(1);

    if (recoveryCode.length === 0) {
      await this.logMfaEvent(userId, 'backup', false, context.ipAddress, context.userAgent);
      return false;
    }

    // Mark code as used
    await db.update(mfaRecoveryCodes)
      .set({ used: true, usedAt: new Date() })
      .where(eq(mfaRecoveryCodes.id, recoveryCode[0].id));

    await this.logMfaEvent(userId, 'backup', true, context.ipAddress, context.userAgent);
    return true;
  }

  /**
   * Add trusted device
   */
  async addTrustedDevice(
    userId: string, 
    context: VerificationContext, 
    options: TrustedDeviceOptions = {}
  ): Promise<string> {
    const deviceFingerprint = generateDeviceFingerprint(context.userAgent, context.ipAddress);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (options.expirationDays || MFA_CONFIG.trustedDeviceDays));

    const deviceData: InsertTrustedDevice = {
      userId,
      deviceFingerprint,
      deviceName: options.deviceName || 'Unknown Device',
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt,
    };

    await db.insert(trustedDevices).values(deviceData);
    await this.logMfaEvent(userId, 'trusted_device_added', true, context.ipAddress, context.userAgent);

    return deviceFingerprint;
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId: string, context: VerificationContext): Promise<boolean> {
    const deviceFingerprint = generateDeviceFingerprint(context.userAgent, context.ipAddress);
    
    const trustedDevice = await db.select()
      .from(trustedDevices)
      .where(and(
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.deviceFingerprint, deviceFingerprint),
        gte(trustedDevices.expiresAt, new Date())
      ))
      .limit(1);

    if (trustedDevice.length > 0) {
      // Update last used timestamp
      await db.update(trustedDevices)
        .set({ lastUsed: new Date() })
        .where(eq(trustedDevices.id, trustedDevice[0].id));
      
      return true;
    }

    return false;
  }

  /**
   * Remove trusted device
   */
  async removeTrustedDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await db.delete(trustedDevices)
      .where(and(
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.id, deviceId)
      ));

    await this.logMfaEvent(userId, 'trusted_device_removed', true, '', '');
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get user's trusted devices
   */
  async getTrustedDevices(userId: string) {
    return await db.select({
      id: trustedDevices.id,
      deviceName: trustedDevices.deviceName,
      lastUsed: trustedDevices.lastUsed,
      createdAt: trustedDevices.createdAt,
      expiresAt: trustedDevices.expiresAt,
    })
    .from(trustedDevices)
    .where(and(
      eq(trustedDevices.userId, userId),
      gte(trustedDevices.expiresAt, new Date())
    ))
    .orderBy(trustedDevices.lastUsed);
  }

  /**
   * Disable MFA for a user (emergency use)
   */
  async disableMfa(userId: string, adminUserId: string): Promise<void> {
    await db.update(mfaSettings)
      .set({ isEnabled: false, updatedAt: new Date() })
      .where(eq(mfaSettings.userId, userId));

    // Remove all trusted devices
    await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId));

    // Log admin action
    await db.insert(auditLog).values({
      userId: adminUserId,
      action: 'mfa_disabled_by_admin',
      resource: 'user',
      resourceId: userId,
      metadata: { targetUserId: userId },
    });
  }

  /**
   * Generate new backup codes
   */
  async generateNewBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = Array.from({ length: MFA_CONFIG.backupCodesCount }, () => 
      generateSecureCode(8)
    );

    const encryptedBackupCodes = backupCodes.map(code => encrypt(code));

    // Update settings
    await db.update(mfaSettings)
      .set({
        backupCodes: JSON.stringify(encryptedBackupCodes),
        updatedAt: new Date(),
      })
      .where(eq(mfaSettings.userId, userId));

    // Clear existing recovery codes and insert new ones
    await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
    
    const recoveryCodeInserts: InsertMfaRecoveryCode[] = backupCodes.map(code => ({
      userId,
      codeHash: hashData(code),
      used: false,
    }));

    await db.insert(mfaRecoveryCodes).values(recoveryCodeInserts);
    await this.logMfaEvent(userId, 'backup_codes_regenerated', true, '', '');

    return backupCodes;
  }

  /**
   * Get MFA status for user
   */
  async getMfaStatus(userId: string) {
    const settings = await this.getUserMfaSettings(userId);
    const trustedDevicesCount = await db.select({ count: count() })
      .from(trustedDevices)
      .where(and(
        eq(trustedDevices.userId, userId),
        gte(trustedDevices.expiresAt, new Date())
      ));

    const unusedBackupCodes = await db.select({ count: count() })
      .from(mfaRecoveryCodes)
      .where(and(
        eq(mfaRecoveryCodes.userId, userId),
        eq(mfaRecoveryCodes.used, false)
      ));

    return {
      enabled: settings?.isEnabled || false,
      hasTotp: !!(settings?.totpSecret),
      hasSms: !!(settings?.smsPhoneNumber),
      hasEmail: !!(settings?.emailAddress),
      inGracePeriod: await this.isInGracePeriod(userId),
      gracePeriodEnd: settings?.gracePeriodEnd,
      trustedDevicesCount: trustedDevicesCount[0].count,
      unusedBackupCodes: unusedBackupCodes[0].count,
    };
  }

  /**
   * Private helper methods
   */
  private async getUserMfaSettings(userId: string): Promise<MfaSettings | null> {
    const settings = await db.select()
      .from(mfaSettings)
      .where(eq(mfaSettings.userId, userId))
      .limit(1);

    return settings.length > 0 ? settings[0] : null;
  }

  private async isRateLimited(userId: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const attempts = await db.select({ count: count() })
      .from(mfaAttempts)
      .where(and(
        eq(mfaAttempts.userId, userId),
        gte(mfaAttempts.attemptedAt, oneHourAgo)
      ));

    return attempts[0].count >= MFA_CONFIG.maxAttemptsPerHour;
  }

  private async logMfaEvent(
    userId: string, 
    method: string, 
    success: boolean, 
    ipAddress: string, 
    userAgent: string
  ): Promise<void> {
    const attemptData: InsertMfaAttempt = {
      userId,
      method,
      success,
      ipAddress,
      userAgent,
    };

    await db.insert(mfaAttempts).values(attemptData);

    // Also log to audit log for compliance
    const auditData: InsertAuditLog = {
      userId,
      action: `mfa_${method}_${success ? 'success' : 'failure'}`,
      resource: 'authentication',
      resourceId: userId,
      metadata: {
        method,
        success,
        ipAddress,
        userAgent: userAgent.substring(0, 255), // Truncate if too long
      },
    };

    await db.insert(auditLog).values(auditData);
  }
}

// Export singleton instance
export const mfaService = new MfaService();