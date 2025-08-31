# Multi-Factor Authentication (MFA) Implementation

## Overview

This document describes the comprehensive Multi-Factor Authentication (MFA) system implemented for the Solicitor Brain v2 application. The system provides secure two-factor authentication compliant with SRA guidelines, GDPR requirements, and UK financial services MFA standards.

## Features

### Authentication Methods
1. **TOTP (Time-based One-Time Password)**
   - Compatible with Google Authenticator, Authy, and other TOTP apps
   - 30-second time window with 2-step tolerance during setup
   - QR code generation for easy setup

2. **SMS Verification**
   - Support for UK mobile numbers (+44 format)
   - Rate-limited to prevent abuse
   - 10-minute expiration for codes

3. **Email Verification**
   - Backup verification method
   - HTML formatted emails with security warnings
   - 10-minute expiration for codes

4. **Backup Codes**
   - 10 single-use recovery codes
   - Secure generation and storage
   - Can be regenerated when needed

### Security Features
- **Trusted Devices**: Remember devices for 30 days (configurable)
- **Grace Period**: 7-day setup period for new users (configurable)
- **Rate Limiting**: Protection against brute force attacks
- **Audit Logging**: Complete audit trail of all MFA events
- **Encryption**: All sensitive data encrypted at rest using AES-256-GCM

## Architecture

### Database Schema

The MFA system uses four main database tables:

1. **mfa_settings** - User MFA configuration and encrypted secrets
2. **trusted_devices** - Device fingerprints and trust relationships
3. **mfa_attempts** - Audit log of all MFA verification attempts
4. **mfa_recovery_codes** - Backup code hashes and usage tracking

### Service Layer

**MfaService** (`/server/services/mfa.ts`)
- Core business logic for all MFA operations
- Handles encryption/decryption of sensitive data
- Manages TOTP, SMS, email, and backup code verification
- Implements rate limiting and security policies

**CryptoService** (`/server/services/crypto.ts`)
- Secure encryption/decryption utilities
- Device fingerprinting
- Secure code generation
- Key management

### API Endpoints

All MFA endpoints are under `/api/mfa/`:

#### Setup Endpoints
- `POST /setup/totp` - Initialize TOTP setup
- `POST /setup/totp/verify` - Complete TOTP setup

#### Verification Endpoints
- `POST /verify/totp` - Verify TOTP code
- `POST /verify/sms` - Verify SMS code
- `POST /verify/email` - Verify email code
- `POST /verify/backup` - Verify backup code

#### Management Endpoints
- `GET /status` - Get user's MFA status
- `POST /send/sms` - Send SMS verification code
- `POST /send/email` - Send email verification code
- `GET /trusted-devices` - List trusted devices
- `POST /trusted-devices` - Add trusted device
- `DELETE /trusted-devices/:id` - Remove trusted device
- `POST /backup-codes/regenerate` - Generate new backup codes
- `POST /disable` - Disable MFA (admin only)

### Frontend Components

**MfaSetup** (`/client/src/components/mfa/MfaSetup.tsx`)
- Complete MFA setup wizard
- QR code display and manual entry
- Backup code management
- Status dashboard

**MfaVerificationModal** (`/client/src/components/mfa/MfaVerificationModal.tsx`)
- Modal for MFA verification during login
- Multiple verification methods in tabs
- Trusted device management
- Error handling and recovery options

**MfaRecovery** (`/client/src/components/mfa/MfaRecovery.tsx`)
- Account recovery flow for lost devices
- Multiple recovery methods
- Admin request workflow

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# MFA Core Configuration
MFA_ENCRYPTION_KEY=your_64_character_hex_key_here
MFA_GRACE_PERIOD_DAYS=7
MFA_MAX_ATTEMPTS_PER_HOUR=5
MFA_TRUSTED_DEVICE_DAYS=30
MFA_BACKUP_CODES_COUNT=10

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
FROM_EMAIL=noreply@solicitor-brain.com

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+44xxxxxxxxxx

# Feature Flag
ENABLE_MFA=true
```

### Generate Encryption Key

Generate a secure encryption key for MFA data:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Setup Instructions

### 1. Database Migration

Run the database migration to create MFA tables:

```bash
npm run db:generate
npm run db:migrate
```

### 2. Configure Services

#### Email Service (Recommended)
Configure SMTP settings for email verification:
- Gmail: Use app-specific passwords
- SendGrid/AWS SES: Use API credentials
- Office 365: Use modern authentication

#### SMS Service (Optional)
Set up Twilio account for UK SMS delivery:
1. Create Twilio account
2. Verify sending phone number
3. Add account SID, auth token, and phone number to config

### 3. Enable MFA Middleware

The MFA middleware is automatically applied to protected routes. It checks:
- Whether MFA is enabled for the user
- If the user is in a grace period
- If the current device is trusted
- If MFA verification is required

## User Flows

### Initial Setup Flow
1. User navigates to MFA setup page
2. Enters email address
3. Scans QR code with authenticator app
4. Enters verification code to confirm setup
5. Downloads/copies backup codes
6. MFA is enabled with 7-day grace period

### Login Flow
1. User logs in with username/password
2. If MFA enabled and device not trusted:
   - MFA verification modal appears
   - User selects verification method
   - Enters code and optionally trusts device
3. Access granted to application

### Recovery Flow
1. User clicks "Lost Device" or similar
2. Chooses recovery method:
   - Backup code entry
   - Email recovery
   - Admin assistance request
3. Follows guided recovery process
4. MFA settings reset or recovered

## Security Considerations

### Data Protection
- **Encryption**: All TOTP secrets, backup codes, and contact info encrypted
- **Hashing**: Backup codes stored as SHA-256 hashes
- **Key Management**: Separate encryption key for MFA data
- **Secure Deletion**: Sensitive data securely overwritten

### Rate Limiting
- **MFA Attempts**: 5 attempts per hour per user
- **Code Generation**: 10 requests per 15 minutes per IP
- **Setup Attempts**: 3 strict rate limit for verification

### Audit Trail
All MFA events are logged with:
- User ID and action type
- Timestamp and IP address
- Success/failure status
- Method used (TOTP, SMS, email, backup)
- User agent information

### Device Security
- **Fingerprinting**: Combination of User-Agent and IP
- **Expiration**: Trusted devices expire after 30 days
- **Revocation**: Users can manually remove trusted devices

## Compliance

### SRA Guidelines
- Strong authentication methods
- Audit trail maintenance
- Secure data handling
- Regular security reviews

### GDPR Requirements
- User consent for data collection
- Right to data portability
- Data minimization principles
- Secure data processing

### UK Financial Services Standards
- Multi-factor authentication requirement
- Risk-based authentication
- Transaction monitoring
- Incident response procedures

## Troubleshooting

### Common Issues

1. **QR Code Not Scanning**
   - Provide manual entry key
   - Check authenticator app compatibility
   - Ensure proper lighting/focus

2. **SMS Not Received**
   - Verify phone number format (+44...)
   - Check network connectivity
   - Confirm Twilio configuration

3. **Email Delays**
   - Check spam/junk folders
   - Verify SMTP configuration
   - Test email connectivity

4. **Time Synchronization**
   - TOTP requires synchronized clocks
   - Check server and device time
   - Allow 2-step window tolerance

### Recovery Procedures

1. **Lost Authenticator Device**
   - Use backup codes
   - Email recovery process
   - Admin reset if necessary

2. **Lost Backup Codes**
   - Generate new codes after MFA verification
   - Use alternative verification method
   - Contact administrator if all methods lost

3. **Account Lockout**
   - Wait for rate limit reset (1 hour)
   - Use alternative verification method
   - Contact administrator for manual unlock

## Monitoring and Maintenance

### Health Checks
- Monitor MFA verification success rates
- Track failed attempt patterns
- Check email/SMS delivery rates
- Verify encryption key availability

### Regular Tasks
- Review audit logs monthly
- Update backup codes annually
- Test recovery procedures quarterly
- Update security dependencies

### Performance Monitoring
- MFA verification response times
- Database query performance
- External service availability (Twilio, SMTP)
- Rate limiting effectiveness

## API Reference

### MFA Status Response
```json
{
  "enabled": true,
  "hasTotp": true,
  "hasSms": false,
  "hasEmail": true,
  "inGracePeriod": false,
  "gracePeriodEnd": null,
  "trustedDevicesCount": 2,
  "unusedBackupCodes": 8,
  "deviceTrusted": true
}
```

### Error Response Format
```json
{
  "error": "Invalid verification code",
  "code": "MFA_INVALID_CODE",
  "retryAfter": 300
}
```

### Rate Limit Headers
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1640995200
```

## Migration Guide

### Enabling MFA for Existing Users
1. Deploy MFA system in grace period mode
2. Notify users of upcoming requirement
3. Provide setup instructions and support
4. Gradually enforce MFA requirement
5. Monitor adoption and assist stragglers

### Backup Strategy
Before deployment:
- Export current user data
- Document recovery procedures  
- Test admin override capabilities
- Prepare support documentation

## Future Enhancements

### Potential Improvements
1. **WebAuthn/FIDO2** support for passwordless authentication
2. **Risk-based authentication** using behavioral analysis
3. **Push notifications** via dedicated mobile app  
4. **Biometric verification** for supported devices
5. **Hardware tokens** (YubiKey) support
6. **Adaptive authentication** based on location/device changes

### API Extensions
- Bulk user MFA management for admins
- MFA policy configuration endpoints
- Advanced reporting and analytics
- Integration with identity providers (SAML/OIDC)

## Support and Contact

For technical issues or questions about the MFA implementation:
- Check troubleshooting section above
- Review audit logs for error details
- Contact system administrator for account recovery
- Submit support tickets for feature requests

---

*This document is maintained alongside the MFA implementation and should be updated with any system changes or enhancements.*