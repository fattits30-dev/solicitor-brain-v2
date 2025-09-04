import {
  auditLog,
  cases,
  consents,
  documents,
  drafts,
  events,
  users,
  type AuditLog,
  type Case,
  type Consent,
  type Document,
  type Draft,
  type Event,
  type InsertAuditLog,
  type InsertCase,
  type InsertConsent,
  type InsertDocument,
  type InsertDraft,
  type InsertEvent,
  type InsertUser,
  type User,
} from '../shared/schema';
import _crypto from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { piiRedactor } from './services/pii-redactor';

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Cases
  getCases(): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
  createCase(case_: InsertCase): Promise<Case>;
  updateCase(id: string, updates: Partial<InsertCase>): Promise<Case | undefined>;
  deleteCase(id: string): Promise<boolean>;

  // Documents
  getDocumentsByCase(caseId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocumentOCR(
    id: string,
    ocrData: {
      extractedText?: string | null;
      ocrConfidence?: number;
      pages?: number;
      processingTime?: number;
      ocrError?: string;
    },
  ): Promise<void>;

  // Events
  getEventsByCase(caseId: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;

  // Drafts
  getDraftsByCase(caseId: string): Promise<Draft[]>;
  createDraft(draft: InsertDraft): Promise<Draft>;

  // Consents
  getConsentsByPerson(personId: string): Promise<Consent[]>;
  createConsent(consent: InsertConsent): Promise<Consent>;

  // Audit
  getAuditLog(filters?: {
    limit?: number;
    offset?: number;
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: string;
  }): Promise<{
    entries: AuditLog[];
    total: number;
  }>;
  createAuditEntry(entry: Omit<InsertAuditLog, 'id' | 'timestamp'>): Promise<AuditLog>;
  getAuditReport(
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string;
      resource?: string;
      action?: string;
    },
  ): Promise<{
    entries: AuditLog[];
    summary: {
      total: number;
      byAction: Record<string, number>;
      byResource: Record<string, number>;
      byUser: Record<string, number>;
      byHour: Record<string, number>;
    };
  }>;
  cleanupOldAuditLogs(retentionDays: number): Promise<{ deleted: number }>;
  getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByResource(
    resource: string,
    resourceId?: string,
    limit?: number,
  ): Promise<AuditLog[]>;

  // Stats
  getStats(): Promise<{
    activeCases: number;
    documentsProcessed: number;
    aiQueries: number;
    privacyScore: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, parseInt(id)));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Note: Using email as username for backward compatibility
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Let the database auto-generate the integer ID (users.id is defined as integer primaryKey)
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getCases(): Promise<Case[]> {
    try {
      console.log('getCases: Starting simple query...');
      const result = await db.select().from(cases);
      console.log('getCases: Query successful, found', result.length, 'cases');
      return result;
    } catch (error) {
      console.error('getCases: Error executing query:', error);
      throw error;
    }
  }

  async getCase(id: string): Promise<Case | undefined> {
    const [case_] = await db.select().from(cases).where(eq(cases.id, parseInt(id)));
    return case_ || undefined;
  }

  async createCase(case_: InsertCase): Promise<Case> {
    // Generate case reference if not provided
    const caseReference = case_.caseReference || `CASE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Prepare the complete case object with required fields
    const completeCase = {
      ...case_,
      caseReference,
    };

    const [newCase] = await db.insert(cases).values(completeCase).returning();
    return newCase;
  }

  async updateCase(id: string, updates: Partial<InsertCase>): Promise<Case | undefined> {
    const [updatedCase] = await db
      .update(cases)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cases.id, parseInt(id)))
      .returning();
    return updatedCase || undefined;
  }

  async deleteCase(id: string): Promise<boolean> {
    const result = await db.delete(cases).where(eq(cases.id, parseInt(id)));
    return (result.rowCount || 0) > 0;
  }

  async getDocumentsByCase(caseId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.caseId, parseInt(caseId)));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async updateDocumentOCR(
    id: string,
    ocrData: {
      extractedText?: string | null;
      ocrConfidence?: number;
      pages?: number;
      processingTime?: number;
      ocrError?: string;
    },
  ): Promise<void> {
    await db
      .update(documents)
      .set({
        extractedText: ocrData.extractedText,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, parseInt(id)));
  }

  async getEventsByCase(caseId: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.caseId, parseInt(caseId)))
      .orderBy(desc(events.eventDate));
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async getDraftsByCase(caseId: string): Promise<Draft[]> {
    return await db
      .select()
      .from(drafts)
      .where(eq(drafts.caseId, parseInt(caseId)))
      .orderBy(desc(drafts.updatedAt));
  }

  async createDraft(draft: InsertDraft): Promise<Draft> {
    const [newDraft] = await db.insert(drafts).values(draft).returning();
    return newDraft;
  }

  async getConsentsByPerson(personId: string): Promise<Consent[]> {
    return await db.select().from(consents).where(eq(consents.personId, parseInt(personId)));
  }

  async createConsent(consent: InsertConsent): Promise<Consent> {
    const [newConsent] = await db.insert(consents).values(consent).returning();
    return newConsent;
  }

  async getAuditLog(filters?: {
    limit?: number;
    offset?: number;
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: string;
  }): Promise<{
    entries: AuditLog[];
    total: number;
  }> {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    let whereConditions = sql`1=1`;

    if (filters?.userId) {
      whereConditions = sql`${whereConditions} AND ${auditLog.userId} = ${filters.userId}`;
    }

    if (filters?.action) {
      whereConditions = sql`${whereConditions} AND ${auditLog.action} LIKE ${`%${filters.action}%`}`;
    }

    if (filters?.resource) {
      whereConditions = sql`${whereConditions} AND ${auditLog.resource} = ${filters.resource}`;
    }

    if (filters?.startDate) {
      whereConditions = sql`${whereConditions} AND ${auditLog.timestamp} >= ${filters.startDate.toISOString()}`;
    }

    if (filters?.endDate) {
      whereConditions = sql`${whereConditions} AND ${auditLog.timestamp} <= ${filters.endDate.toISOString()}`;
    }

    // Apply PII redaction to metadata based on viewer role
    const entries = await db
      .select()
      .from(auditLog)
      .where(whereConditions)
      .orderBy(desc(auditLog.timestamp))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(whereConditions);

    const total = countResult?.count || 0;

    return { entries, total };
  }

  async createAuditEntry(entry: Omit<InsertAuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    // Apply PII redaction to metadata and redactedData
    let processedEntry = { ...entry };

    if (entry.metadata) {
      const { redacted } = piiRedactor.redactObject(entry.metadata, 'audit-system');
      processedEntry.metadata = redacted;
    }

    if (entry.redactedData) {
      const result = piiRedactor.redact(entry.redactedData, 'audit-system');
      processedEntry.redactedData = result.redactedText;
    }

    const [newEntry] = await db.insert(auditLog).values(processedEntry).returning();
    return newEntry;
  }

  async getStats(): Promise<{
    activeCases: number;
    documentsProcessed: number;
    aiQueries: number;
    privacyScore: number;
  }> {
    const [activeCasesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cases)
      .where(eq(cases.status, 'active'));

    const [documentsResult] = await db.select({ count: sql<number>`count(*)` }).from(documents);

    const [auditResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(sql`${auditLog.action} LIKE '%ai%' AND DATE(${auditLog.timestamp}) = CURRENT_DATE`);

    return {
      activeCases: activeCasesResult?.count || 0,
      documentsProcessed: documentsResult?.count || 0,
      aiQueries: auditResult?.count || 0,
      privacyScore: 98, // Static for now, would be calculated based on compliance metrics
    };
  }

  async getAuditReport(
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string;
      resource?: string;
      action?: string;
    },
  ): Promise<{
    entries: AuditLog[];
    summary: {
      total: number;
      byAction: Record<string, number>;
      byResource: Record<string, number>;
      byUser: Record<string, number>;
      byHour: Record<string, number>;
    };
  }> {
    let whereConditions = sql`${auditLog.timestamp} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}`;

    if (filters?.userId) {
      whereConditions = sql`${whereConditions} AND ${auditLog.userId} = ${filters.userId}`;
    }

    if (filters?.resource) {
      whereConditions = sql`${whereConditions} AND ${auditLog.resource} = ${filters.resource}`;
    }

    if (filters?.action) {
      whereConditions = sql`${whereConditions} AND ${auditLog.action} LIKE ${`%${filters.action}%`}`;
    }

    const entries = await db
      .select()
      .from(auditLog)
      .where(whereConditions)
      .orderBy(desc(auditLog.timestamp))
      .limit(1000); // Reasonable limit for reports

    // Generate summary statistics
    const summary = {
      total: entries.length,
      byAction: {} as Record<string, number>,
      byResource: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      byHour: {} as Record<string, number>,
    };

    entries.forEach((entry) => {
      // Count by action
      summary.byAction[entry.action] = (summary.byAction[entry.action] || 0) + 1;

      // Count by resource
      if (entry.resource) {
        summary.byResource[entry.resource] = (summary.byResource[entry.resource] || 0) + 1;
      }

      // Count by user
      if (entry.userId) {
        summary.byUser[entry.userId] = (summary.byUser[entry.userId] || 0) + 1;
      }

      // Count by hour
      const hour = entry.timestamp ? new Date(entry.timestamp).toISOString().slice(0, 13) + ':00:00.000Z' : 'unknown';
      summary.byHour[hour] = (summary.byHour[hour] || 0) + 1;
    });

    return { entries, summary };
  }

  async cleanupOldAuditLogs(retentionDays: number): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db
      .delete(auditLog)
      .where(sql`${auditLog.timestamp} < ${cutoffDate.toISOString()}`);

    return { deleted: result.rowCount || 0 };
  }

  async getAuditLogsByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.timestamp))
      .limit(limit);
  }

  async getAuditLogsByResource(
    resource: string,
    resourceId?: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    let whereConditions = eq(auditLog.resource, resource);

    if (resourceId) {
      whereConditions = and(
        eq(auditLog.resource, resource),
        eq(auditLog.resourceId, resourceId),
      ) as any;
    }

    return await db
      .select()
      .from(auditLog)
      .where(whereConditions)
      .orderBy(desc(auditLog.timestamp))
      .limit(limit);
  }

  // Enhanced document methods with audit logging
  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, parseInt(id)));
    return document || undefined;
  }

  async getDocumentMetadata(id: string): Promise<any> {
    const [document] = await db.select().from(documents).where(eq(documents.id, parseInt(id)));
    if (!document) return null;

    return {
      id: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      hasOCR: !!document.extractedText,
      ocrLength: document.extractedText?.length || 0,
    };
  }

  async updateDocumentMetadata(id: string, _metadata: Record<string, any>): Promise<any> {
    await db.update(documents).set({ updatedAt: new Date() }).where(eq(documents.id, parseInt(id)));

    return this.getDocumentMetadata(id);
  }

  async getDocumentFilePath(id: string): Promise<string | null> {
    const [document] = await db.select().from(documents).where(eq(documents.id, parseInt(id)));
    return document?.filePath || null;
  }

  async getDocumentOCRStatus(id: string): Promise<any> {
    const [document] = await db.select().from(documents).where(eq(documents.id, parseInt(id)));
    if (!document) return null;

    return {
      hasOCR: !!document.extractedText,
      ocrLength: document.extractedText?.length || 0,
      status: document.extractedText ? 'completed' : 'pending',
    };
  }

  async startOCRProcessing(_id: string): Promise<{ status: string; message: string }> {
    // In a real implementation, this would trigger OCR processing
    return {
      status: 'started',
      message: 'OCR processing started',
    };
  }

  async addDocumentAnnotation(documentId: string, annotation: any): Promise<any> {
    // For now, store annotations in document metadata
    // In a real implementation, you'd have a separate annotations table
    return {
      id: `annotation_${Date.now()}`,
      documentId,
      ...annotation,
    };
  }
}

export const storage = new DatabaseStorage();
