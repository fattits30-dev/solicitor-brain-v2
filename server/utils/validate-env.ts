import { z } from 'zod';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Environment schema with validation rules
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.string().regex(/^\d+$/).transform(Number),
  API_URL: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().url(),
  DB_SSL: z
    .string()
    .transform((v) => v === 'true')
    .optional(),

  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  BCRYPT_ROUNDS: z.string().regex(/^\d+$/).transform(Number).default('10'),

  // AI Features
  ENABLE_AI_FEATURES: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),

  // File Upload
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().regex(/^\d+$/).transform(Number).default('10485760'),

  // Security
  CORS_ORIGIN: z.string().optional(),
  SECURE_COOKIES: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  TRUST_PROXY: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // Audit
  AUDIT_RETENTION_YEARS: z.string().regex(/^\d+$/).transform(Number).default('7'),
  PII_REDACTION_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // MFA (Optional)
  ENABLE_MFA: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  MFA_ENCRYPTION_KEY: z.string().min(32).optional(),
  MFA_GRACE_PERIOD_DAYS: z.string().regex(/^\d+$/).transform(Number).optional(),

  // Email (Optional for MFA)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().regex(/^\d+$/).transform(Number).optional(),
  SMTP_USER: z.string().email().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default('100'),
});

type EnvConfig = z.infer<typeof envSchema>;

class EnvironmentValidator {
  private config: EnvConfig | null = null;
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor() {
    this.validate();
  }

  private validate(): void {
    try {
      // Parse and validate environment variables
      this.config = envSchema.parse(process.env);

      // Additional validation checks
      this.performSecurityChecks();
      this.checkRequiredFiles();
      this.validateDatabaseConnection();

      if (this.errors.length > 0) {
        this.reportErrors();
        process.exit(1);
      }

      if (this.warnings.length > 0) {
        this.reportWarnings();
      }

      console.log('✅ Environment validation successful');
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Environment validation failed:');
        error.errors.forEach((err) => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      }
      throw error;
    }
  }

  private performSecurityChecks(): void {
    if (!this.config) return;

    const _isDev = this.config.NODE_ENV === 'development';
    const isProd = this.config.NODE_ENV === 'production';

    // Check for default secrets
    if (this.config.JWT_SECRET === 'your-jwt-secret-here') {
      this.errors.push('JWT_SECRET is using default value - please generate a secure secret');
    }

    if (this.config.SESSION_SECRET === 'your-secure-session-secret-here') {
      this.errors.push('SESSION_SECRET is using default value - please generate a secure secret');
    }

    // Production-specific checks
    if (isProd) {
      if (!this.config.SECURE_COOKIES) {
        this.errors.push('SECURE_COOKIES must be enabled in production');
      }

      if (!this.config.DB_SSL) {
        this.warnings.push(
          'Database SSL is disabled in production - consider enabling for security',
        );
      }

      if (this.config.CORS_ORIGIN === '*') {
        this.errors.push('CORS_ORIGIN cannot be * in production');
      }
    }

    // MFA checks
    if (this.config.ENABLE_MFA && !this.config.MFA_ENCRYPTION_KEY) {
      this.errors.push('MFA_ENCRYPTION_KEY is required when MFA is enabled');
    }

    // AI features checks
    if (this.config.ENABLE_AI_FEATURES && !this.config.OLLAMA_BASE_URL) {
      this.warnings.push('AI features enabled but OLLAMA_BASE_URL not configured');
    }
  }

  private checkRequiredFiles(): void {
    if (!this.config) return;

    // Check upload directory exists
    const uploadPath = path.resolve(this.config.UPLOAD_DIR);
    if (!existsSync(uploadPath)) {
      this.warnings.push(`Upload directory does not exist: ${uploadPath}`);
    }

    // Check .env file exists
    if (!existsSync('.env')) {
      this.errors.push('.env file not found - copy .env.example and configure');
    }
  }

  private validateDatabaseConnection(): void {
    if (!this.config) return;

    try {
      const url = new URL(this.config.DATABASE_URL);

      // Check for default credentials
      if (url.username === 'user' || url.password === 'password') {
        this.warnings.push('Database is using default credentials - update for security');
      }

      // Validate port
      const port = parseInt(url.port || '5432');
      if (port !== 5433 && port !== 5432) {
        this.warnings.push(`Unusual PostgreSQL port: ${port}`);
      }
    } catch (error) {
      this.errors.push(`Invalid DATABASE_URL format: ${error}`);
    }
  }

  private reportErrors(): void {
    console.error('\n❌ Environment Configuration Errors:');
    this.errors.forEach((error) => {
      console.error(`  ⛔ ${error}`);
    });
    console.error('\n');
  }

  private reportWarnings(): void {
    console.warn('\n⚠️  Environment Configuration Warnings:');
    this.warnings.forEach((warning) => {
      console.warn(`  ⚠️  ${warning}`);
    });
    console.warn('\n');
  }

  public getConfig(): EnvConfig {
    if (!this.config) {
      throw new Error('Environment not validated');
    }
    return this.config;
  }

  public isProduction(): boolean {
    return this.config?.NODE_ENV === 'production';
  }

  public isDevelopment(): boolean {
    return this.config?.NODE_ENV === 'development';
  }

  public isTest(): boolean {
    return this.config?.NODE_ENV === 'test';
  }
}

// Export singleton instance
export const env = new EnvironmentValidator();
export const config = env.getConfig();
export default env;
