/**
 * PII Redaction Integration Example for Solicitor Brain v2
 *
 * This file demonstrates how to integrate the comprehensive PII redaction system
 * into the existing Express.js server architecture.
 */

import express, { NextFunction, Request, Response } from 'express';
import {
  piiAuthErrorHandler,
  piiDatabaseErrorHandler,
  piiErrorHandler,
  piiValidationErrorHandler,
} from '../middleware/pii-error-handler';
import {
  createPIIConsoleLogger,
  piiExportWarningMiddleware,
  piiLoggingMiddleware,
} from '../middleware/pii-logging';
import { PIIRedactionService, piiRedactor, RedactionLevel } from '../services/pii-redactor';
import { AuditEventType, auditLogger, AuditSeverity } from '../utils/audit-logger';

/**
 * STEP 1: Initialize PII redaction system with custom configuration
 */
export function initializePIIRedaction() {
  // Load configuration from JSON file or environment
  const config = {
    defaultLevel: RedactionLevel.FULL,
    roleBasedLevels: {
      admin: RedactionLevel.NONE,
      senior_solicitor: RedactionLevel.PARTIAL,
      solicitor: RedactionLevel.PARTIAL,
      paralegal: RedactionLevel.FULL,
      support: RedactionLevel.FULL,
    },
    logRedactions: true,
    preserveFormat: true,
  };

  // Initialize with custom configuration
  const customRedactor = new PIIRedactionService(config);

  // Add custom UK legal patterns
  customRedactor.addCustomRule({
    id: 'solicitor-reference',
    name: 'Solicitor Reference Numbers',
    pattern: /\bSLR[0-9]{6}\b/g,
    category: 'LEGAL',
    severity: 'MEDIUM',
    enabled: true,
    replacement: {
      [RedactionLevel.FULL]: '[SLR_REDACTED]',
      [RedactionLevel.PARTIAL]: (match: string) => 'SLR' + 'X'.repeat(match.length - 3),
      [RedactionLevel.HASH]: (match: string) => customRedactor['generateHash'](match, 'SLR'),
      [RedactionLevel.NONE]: (match: string) => match,
    },
  });

  return customRedactor;
}

/**
 * STEP 2: Apply PII redaction middleware to Express app
 */
export function applyPIIMiddleware(app: express.Application) {
  // Development console logging with PII redaction
  if (process.env.NODE_ENV === 'development') {
    app.use(createPIIConsoleLogger());
  }

  // Global PII logging middleware
  app.use(
    piiLoggingMiddleware({
      logRequests: true,
      logResponses: true,
      redactResponses: true,
      sensitiveRoutes: ['/api/cases', '/api/persons', '/api/documents', '/api/users'],
      excludeRoutes: ['/api/health', '/api/ping', '/api/version'],
      maxBodySize: 10000, // 10KB max for request body logging
    }),
  );

  // Export warning middleware for data export endpoints
  app.use('/api/*/export', piiExportWarningMiddleware());
  app.use('/api/export', piiExportWarningMiddleware());
}

/**
 * STEP 3: Apply PII error handling middleware
 */
export function applyPIIErrorHandlers(app: express.Application) {
  // Specific error handlers (order matters - most specific first)
  app.use(piiAuthErrorHandler());
  app.use(piiValidationErrorHandler());
  app.use(piiDatabaseErrorHandler());

  // General PII error handler (should be last)
  app.use(
    piiErrorHandler({
      includeStackTrace: process.env.NODE_ENV === 'development',
      logErrors: true,
      redactErrorDetails: true,
      showDetailedErrors: process.env.NODE_ENV === 'development',
    }),
  );
}

/**
 * STEP 4: Replace existing logging middleware in server/index.ts
 */
export function createPIIAwareLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;

      // Apply PII redaction to logged responses
      if (path.startsWith('/api') && bodyJson) {
        const userRole = req.user?.role || 'guest';
        const { redacted } = piiRedactor.redactObject(bodyJson, userRole, RedactionLevel.PARTIAL);
        capturedJsonResponse = redacted;
      }

      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on('finish', () => {
      const duration = Date.now() - start;
      if (path.startsWith('/api')) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + '…';
        }

        console.log(logLine);
      }
    });

    next();
  };
}

/**
 * STEP 5: Route-level PII redaction examples
 */
export function createPIIProtectedRoute() {
  const router = express.Router();

  // Example: Case details endpoint with automatic PII redaction
  router.get('/cases/:id', async (req: Request, res: Response) => {
    // Fetch case data (example)
    const caseData = {
      id: req.params.id,
      clientName: 'John Smith',
      clientEmail: 'john.smith@example.com',
      clientPhone: '+44 7123 456789',
      address: '123 High Street, London',
      nationalInsurance: 'AB 12 34 56 C',
      details: 'Client involved in property dispute...',
    };

    const userRole = req.user?.role || 'guest';

    // Apply PII redaction based on user role
    const { redacted, summary } = piiRedactor.redactObject(caseData, userRole);

    // Log if PII was redacted
    if (summary.length > 0) {
      auditLogger.logDataAccess(req.user?.id || 'anonymous', `case:${req.params.id}`, 'READ', true);
    }

    res.json({
      success: true,
      data: redacted,
      piiRedacted: summary.length > 0,
      redactionLevel: piiRedactor['determineRedactionLevel'](userRole),
    });
  });

  // Example: Document upload with PII detection
  router.post('/documents', async (req: Request, res: Response) => {
    const { title: _title, content } = req.body;

    // Check for PII in document content
    const piiCheck = piiRedactor.containsPII(content);

    if (piiCheck.hasPII) {
      auditLogger.log(AuditEventType.DATA_CREATE, AuditSeverity.WARNING, 'SUCCESS', {
        userId: req.user?.id || 'anonymous',
        resource: 'document',
        action: 'CREATE_WITH_PII',
        details: {
          piiCategories: piiCheck.categories,
          piiSeverities: piiCheck.severities,
          ruleMatches: piiCheck.ruleMatches.length,
        },
      });
    }

    // Store document with PII warnings
    const documentId = 'doc123'; // Example ID

    res.json({
      success: true,
      documentId,
      piiDetected: piiCheck.hasPII,
      piiWarning: piiCheck.hasPII
        ? 'This document contains personal identifiable information. Please ensure proper consent and data handling procedures are followed.'
        : null,
    });
  });

  return router;
}

/**
 * STEP 6: Database query PII redaction helper
 */
export function redactDatabaseResults(results: any[], userRole: string) {
  return results.map((result) => {
    const { redacted } = piiRedactor.redactObject(result, userRole);
    return redacted;
  });
}

/**
 * STEP 7: Environment variable configuration
 * Add these to your .env file:
 */
export const REQUIRED_ENV_VARIABLES = `
# PII Redaction Configuration
PII_REDACTION_SALT=your-secure-random-salt-here
PII_DEFAULT_LEVEL=FULL
PII_LOG_REDACTIONS=true
PII_PRESERVE_FORMAT=true

# Role-based redaction levels (comma-separated)
PII_ADMIN_ROLES=admin,senior_solicitor
PII_PARTIAL_ROLES=solicitor,paralegal
PII_FULL_ROLES=support,guest

# Export controls
PII_BLOCK_EXPORTS_WITH_PII=true
PII_REQUIRE_EXPORT_CONSENT=true
`;

/**
 * STEP 8: Complete server integration example
 */
export function createPIIProtectedServer() {
  const app = express();

  // Basic Express setup
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Initialize PII redaction system
  initializePIIRedaction();

  // Apply PII middleware
  applyPIIMiddleware(app);

  // Replace default logging with PII-aware logging
  app.use(createPIIAwareLoggingMiddleware());

  // Register routes
  app.use('/api', createPIIProtectedRoute());

  // Apply PII error handlers (must be after routes)
  applyPIIErrorHandlers(app);

  return app;
}

/**
 * STEP 9: Testing PII redaction
 */
export function testPIIRedaction() {
  const testData = {
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+44 7123 456789',
    ni: 'AB 12 34 56 C',
    address: '123 High Street, London SW1A 1AA',
    caseRef: 'CASE-123456',
  };

  console.log('=== PII Redaction Test ===');

  // Test different redaction levels
  const levels = [
    RedactionLevel.NONE,
    RedactionLevel.PARTIAL,
    RedactionLevel.FULL,
    RedactionLevel.HASH,
  ];

  levels.forEach((level) => {
    console.log(`\n--- ${level} Level ---`);
    const { redacted } = piiRedactor.redactObject(testData, 'test', level);
    console.log(JSON.stringify(redacted, null, 2));
  });

  // Test PII detection
  const piiCheck = piiRedactor.containsPII(JSON.stringify(testData));
  console.log('\n--- PII Detection ---');
  console.log('Has PII:', piiCheck.hasPII);
  console.log('Categories:', piiCheck.categories);
  console.log('Rule matches:', piiCheck.ruleMatches.length);
}

export default {
  initializePIIRedaction,
  applyPIIMiddleware,
  applyPIIErrorHandlers,
  createPIIAwareLoggingMiddleware,
  createPIIProtectedRoute,
  redactDatabaseResults,
  createPIIProtectedServer,
  testPIIRedaction,
};
