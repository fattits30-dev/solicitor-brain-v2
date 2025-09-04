// MFA API utility functions
import { apiClient } from './api-client';

export interface MfaStatus {
  enabled: boolean;
  hasTotp: boolean;
  hasSms: boolean;
  hasEmail: boolean;
  inGracePeriod: boolean;
  gracePeriodEnd?: string;
  deviceTrusted: boolean;
  unusedBackupCodes: number;
  trustedDevicesCount?: number;
}

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaVerificationResponse {
  success: boolean;
  message?: string;
  error?: string;
  trusted?: boolean;
}

export interface TrustedDeviceRequest {
  deviceName?: string;
  expirationDays?: number;
}

/**
 * Get current user's MFA status
 */
export async function getMfaStatus(): Promise<MfaStatus> {
  return apiClient.get<MfaStatus>('/api/mfa/status');
}

/**
 * Setup TOTP (Time-based One-Time Password)
 */
export async function setupTotp(email: string): Promise<MfaSetupResponse> {
  return apiClient.post<MfaSetupResponse>('/api/mfa/setup/totp', { email });
}

/**
 * Verify TOTP setup with a verification token
 */
export async function verifyTotpSetup(token: string): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/setup/totp/verify', { token });
}

/**
 * Verify TOTP token during login/authentication
 */
export async function verifyTotp(token: string): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/verify/totp', { token });
}

/**
 * Send SMS verification code
 */
export async function sendSmsCode(phoneNumber: string): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/send/sms', { phoneNumber });
}

/**
 * Verify SMS code
 */
export async function verifySms(code: string): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/verify/sms', { code });
}

/**
 * Send email verification code
 */
export async function sendEmailCode(): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/send/email');
}

/**
 * Verify email code
 */
export async function verifyEmail(code: string): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/verify/email', { code });
}

/**
 * Verify backup code
 */
export async function verifyBackupCode(code: string): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/verify/backup', { code });
}

/**
 * Add current device as trusted
 */
export async function addTrustedDevice(
  request: TrustedDeviceRequest,
): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/trusted-devices', request);
}

/**
 * Get list of trusted devices
 */
export async function getTrustedDevices(): Promise<any[]> {
  return apiClient.get<any[]>('/api/mfa/trusted-devices');
}

/**
 * Remove a trusted device
 */
export async function removeTrustedDevice(deviceId: string): Promise<MfaVerificationResponse> {
  return apiClient.delete<MfaVerificationResponse>(`/api/mfa/trusted-devices/${deviceId}`);
}

/**
 * Generate new backup codes
 */
export async function regenerateBackupCodes(): Promise<{ backupCodes: string[] }> {
  return apiClient.post<{ backupCodes: string[] }>('/api/mfa/backup-codes/regenerate');
}

/**
 * Check if current device is trusted
 */
export async function isDeviceTrusted(): Promise<{ trusted: boolean }> {
  return apiClient.get<{ trusted: boolean }>('/api/mfa/device/trusted');
}

/**
 * Complete MFA verification (call after successful verification)
 */
export async function completeMfaVerification(): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/complete');
}

/**
 * Disable MFA (admin only)
 */
export async function disableMfa(userId?: string): Promise<MfaVerificationResponse> {
  return apiClient.post<MfaVerificationResponse>('/api/mfa/disable', userId ? { userId } : {});
}
