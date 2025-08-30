import { db } from "../db.js";
import { auditLog as auditLogTable } from "../../shared/schema.js";
import type { InsertAuditLog } from "../../shared/schema.js";

/**
 * List of fields that should be redacted in audit logs
 */
const REDACTED_FIELDS = [
  "password",
  "token",
  "sessionId",
  "creditCard",
  "ssn",
  "nationalInsurance",
  "dateOfBirth",
  "address",
  "phone",
  "email",
];

/**
 * Redact sensitive information from data
 */
function redactSensitiveData(data: any): any {
  if (!data) return data;
  
  if (typeof data === "string") {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }
  
  if (typeof data === "object") {
    const redacted: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (REDACTED_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    
    return redacted;
  }
  
  return data;
}

/**
 * Create an audit log entry
 */
export async function auditLog(entry: Omit<InsertAuditLog, "redactedData">) {
  try {
    // Redact sensitive data from metadata
    const redactedMetadata = entry.metadata 
      ? redactSensitiveData(entry.metadata) 
      : null;
    
    // Create a list of redacted fields
    const redactedFields: string[] = [];
    if (entry.metadata && typeof entry.metadata === "object") {
      for (const key of Object.keys(entry.metadata)) {
        if (REDACTED_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          redactedFields.push(key);
        }
      }
    }
    
    await db.insert(auditLogTable).values({
      ...entry,
      metadata: redactedMetadata,
      redactedData: redactedFields.length > 0 ? redactedFields.join(", ") : null,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
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
  
  const logs = await query
    .limit(limit)
    .offset(offset)
    .orderBy(auditLogTable.timestamp);
  
  return logs;
}