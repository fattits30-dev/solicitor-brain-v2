import crypto from 'crypto';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Development Security Module
 * Protects sensitive data and prevents accidental exposure
 */

interface SensitivePattern {
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  description: string;
}

class DevelopmentSecurity {
  private readonly sensitivePatterns: SensitivePattern[] = [
    // Authentication tokens
    {
      pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
      replacement: 'Bearer [REDACTED]',
      description: 'JWT/Bearer tokens',
    },
    {
      pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
      replacement: '[JWT_REDACTED]',
      description: 'JWT tokens',
    },

    // API Keys
    {
      pattern: /api[_-]?key[\s]*[:=][\s]*["']?[A-Za-z0-9\-._]+["']?/gi,
      replacement: 'api_key=[REDACTED]',
      description: 'API keys',
    },

    // Passwords
    {
      pattern: /password[\s]*[:=][\s]*["']?[^"'\s]+["']?/gi,
      replacement: 'password=[REDACTED]',
      description: 'Passwords',
    },

    // Database URLs
    {
      pattern: /postgresql:\/\/[^@]+@[^\s]+/gi,
      replacement: 'postgresql://[REDACTED]@[REDACTED]',
      description: 'PostgreSQL URLs',
    },
    {
      pattern: /redis:\/\/[^@]+@[^\s]+/gi,
      replacement: 'redis://[REDACTED]',
      description: 'Redis URLs',
    },

    // Email addresses (PII)
    {
      pattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      replacement: (match: string) => {
        const [local, domain] = match.split('@');
        return `${local.substring(0, 2)}***@${domain}`;
      },
      description: 'Email addresses',
    },

    // UK Phone numbers
    {
      pattern: /(\+44|0)[\s]?[1-9][\s]?[\d\s]{8,10}/g,
      replacement: '+44XXXXXXXXXX',
      description: 'UK phone numbers',
    },

    // UK National Insurance numbers
    {
      pattern: /[A-Z]{2}[\s]?[\d]{2}[\s]?[\d]{2}[\s]?[\d]{2}[\s]?[A-Z]/gi,
      replacement: 'NI_[REDACTED]',
      description: 'National Insurance numbers',
    },

    // Credit card numbers
    {
      pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
      replacement: 'XXXX-XXXX-XXXX-XXXX',
      description: 'Credit card numbers',
    },

    // AWS credentials
    {
      pattern: /AKIA[0-9A-Z]{16}/g,
      replacement: 'AKIA[REDACTED]',
      description: 'AWS Access Key IDs',
    },

    // Private keys
    {
      pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+ PRIVATE KEY-----/g,
      replacement: '-----BEGIN PRIVATE KEY-----\n[REDACTED]\n-----END PRIVATE KEY-----',
      description: 'Private keys',
    },
  ];

  private readonly protectedFiles = [
    '.env',
    '.env.local',
    '.env.production',
    'config/secrets.json',
    'config/credentials.json',
  ];

  /**
   * Redact sensitive information from a string
   */
  public redactSensitiveData(input: string): string {
    let redacted = input;

    for (const { pattern, replacement } of this.sensitivePatterns) {
      if (typeof replacement === 'string') {
        redacted = redacted.replace(pattern, replacement);
      } else {
        redacted = redacted.replace(pattern, replacement);
      }
    }

    return redacted;
  }

  /**
   * Check if a file contains sensitive data
   */
  public checkFileForSensitiveData(filePath: string): {
    hasSensitive: boolean;
    matches: string[];
  } {
    if (!existsSync(filePath)) {
      return { hasSensitive: false, matches: [] };
    }

    const content = readFileSync(filePath, 'utf-8');
    const matches: string[] = [];

    for (const { pattern, description } of this.sensitivePatterns) {
      const found = content.match(pattern);
      if (found && found.length > 0) {
        matches.push(`Found ${description}: ${found.length} occurrence(s)`);
      }
    }

    return {
      hasSensitive: matches.length > 0,
      matches,
    };
  }

  /**
   * Generate secure random secrets
   */
  public generateSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure JWT secret
   */
  public generateJWTSecret(): string {
    return this.generateSecret(64);
  }

  /**
   * Hash sensitive data for logging
   */
  public hashForLogging(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
  }

  /**
   * Check if environment is properly secured
   */
  public checkEnvironmentSecurity(): {
    secure: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for .env file
    if (!existsSync('.env')) {
      issues.push('Missing .env file');
    }

    // Check for default secrets
    const env = process.env;

    if (env.JWT_SECRET === 'your-jwt-secret-here') {
      issues.push('Using default JWT_SECRET');
    }

    if (env.SESSION_SECRET === 'your-secure-session-secret-here') {
      issues.push('Using default SESSION_SECRET');
    }

    if (env.DATABASE_URL?.includes('user:password')) {
      issues.push('Using default database credentials');
    }

    // Check file permissions on sensitive files
    for (const file of this.protectedFiles) {
      if (existsSync(file)) {
        const stats = require('fs').statSync(file);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);

        if (mode !== '600' && mode !== '400') {
          issues.push(`Insecure permissions on ${file}: ${mode} (should be 600 or 400)`);
        }
      }
    }

    // Check if running as root (Unix-like systems)
    if (process.getuid && process.getuid() === 0) {
      issues.push('Running as root user - security risk');
    }

    return {
      secure: issues.length === 0,
      issues,
    };
  }

  /**
   * Create a secure development certificate
   */
  public generateDevCertificate(): {
    key: string;
    cert: string;
  } {
    // This would normally use node-forge or similar
    // For now, return placeholders
    return {
      key: '-----BEGIN PRIVATE KEY-----\n[Dev Key - Generate with openssl]\n-----END PRIVATE KEY-----',
      cert: '-----BEGIN CERTIFICATE-----\n[Dev Cert - Generate with openssl]\n-----END CERTIFICATE-----',
    };
  }

  /**
   * Sanitize user input
   */
  public sanitizeInput(input: string): string {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Remove control characters (except newline and tab)
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Escape HTML entities
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return sanitized;
  }

  /**
   * Validate file upload
   */
  public validateFileUpload(
    filePath: string,
    allowedTypes: string[] = ['pdf', 'doc', 'docx', 'txt'],
    maxSize: number = 10 * 1024 * 1024, // 10MB
  ): {
    valid: boolean;
    error?: string;
  } {
    if (!existsSync(filePath)) {
      return { valid: false, error: 'File not found' };
    }

    const stats = require('fs').statSync(filePath);

    // Check file size
    if (stats.size > maxSize) {
      return { valid: false, error: `File too large: ${stats.size} bytes (max: ${maxSize})` };
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase().substring(1);
    if (!allowedTypes.includes(ext)) {
      return { valid: false, error: `Invalid file type: ${ext}` };
    }

    // Check for executable files
    const dangerousExtensions = ['exe', 'dll', 'sh', 'bat', 'cmd', 'app'];
    if (dangerousExtensions.includes(ext)) {
      return { valid: false, error: 'Executable files not allowed' };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const devSecurity = new DevelopmentSecurity();
export default devSecurity;
