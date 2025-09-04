import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is 16 bytes
const _TAG_LENGTH = 16; // For GCM, this is 16 bytes
const ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('MFA_ENCRYPTION_KEY must be set in environment variables');
}

// Convert hex key to buffer
const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');

if (keyBuffer.length !== 32) {
  throw new Error('MFA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
}

export interface EncryptedData {
  iv: string;
  tag: string;
  data: string;
}

/**
 * Encrypts sensitive data using AES-256-GCM
 */
export function encrypt(text: string): EncryptedData {
  const _iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipher(ALGORITHM, keyBuffer);
  cipher.setAAD(Buffer.from('mfa-data'));

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    iv: _iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted,
  };
}

/**
 * Decrypts sensitive data using AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData): string {
  const _iv = Buffer.from(encryptedData.iv, 'hex');
  const tag = Buffer.from(encryptedData.tag, 'hex');

  const decipher = crypto.createDecipher(ALGORITHM, keyBuffer);
  decipher.setAAD(Buffer.from('mfa-data'));
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a secure random key for MFA encryption
 * Run this once and store in environment variables
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes data using SHA-256 for backup codes storage
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generates cryptographically secure random codes
 */
export function generateSecureCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }

  return result;
}

/**
 * Generates device fingerprint from request data
 */
export function generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
  const data = `${userAgent}:${ipAddress}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}
