import type { InsertAuditLog } from '@shared/schema';
import { auditLog as auditLogTable } from '@shared/schema';
import { db } from '../db';

/**
 * List of fields that should be redacted in audit logs
 */
const REDACTED_FIELDS = [
  'password',
  'token',
  'sessionId',
  'creditCard',
  'ssn',
  'nationalInsurance',
  'dateOfBirth',
  'address',
  'phone',
  'email',
];

/**
 * Redact sensitive information from data
 */
function redactSensitiveData(data: any): any {
  if (!data) return data;

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const redacted: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (REDACTED_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        // If the key itself is sensitive, redact the entire value
        if (Array.isArray(value)) {
          // For arrays, redact each element
          redacted[key] = value.map(() => '[REDACTED]');
        } else {
          redacted[key] = '[REDACTED]';
        }
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }

    return redacted;
  }

  return data;
}

/**
 * Collect all redacted field names from metadata (top-level keys only)
 */
function collectRedactedFields(data: any): string[] {
  if (!data || typeof data !== 'object') return [];

  const fields: string[] = [];

  for (const key of Object.keys(data)) {
    if (REDACTED_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      fields.push(key);
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      // Recursively check nested objects for sensitive fields
      const nestedFields = collectRedactedFields(data[key]);
      if (nestedFields.length > 0) {
        fields.push(...nestedFields);
      }
    }
  }

  return [...new Set(fields)]; // Remove duplicates
}

/**
 * Create an audit log entry
 */
export async function auditLog(entry: Omit<InsertAuditLog, 'redactedData'>) {
  try {
    // Redact sensitive data from metadata
    const redactedMetadata = entry.metadata ? redactSensitiveData(entry.metadata) : null;

    // Create a list of redacted fields (including nested ones)
    const redactedFields = entry.metadata ? collectRedactedFields(entry.metadata) : [];

    await db.insert(auditLogTable).values({
      ...entry,
      metadata: redactedMetadata,
      redactedData: redactedFields.length > 0 ? redactedFields.join(', ') : null,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the application
  }
}

/**
 * Get audit logs with pagination
 */
export async function getAuditLogs(options: {
  userId?: string;
  resource?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const { limit = 50, offset = 0 } = options;

  let query = db.select().from(auditLogTable);

  // Apply filters
  // Note: In a real implementation, we'd use Drizzle's where conditions
  // For now, we'll just return all and filter in memory

  const logs = await query.limit(limit).offset(offset).orderBy(auditLogTable.timestamp);

  return logs;
}
