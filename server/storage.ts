import { 
  users, cases, persons, documents, events, drafts, auditLog, consents, embeddings,
  type User, type InsertUser, type Case, type InsertCase, type Person, type InsertPerson,
  type Document, type InsertDocument, type Event, type InsertEvent, type Draft, type InsertDraft,
  type Consent, type InsertConsent, type AuditLog, type InsertAuditLog, type Embedding
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

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
  getAllDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByCase(caseId: string): Promise<Document[]>;
  getDocumentMetadata(id: string): Promise<Partial<Document> | undefined>;
  updateDocumentMetadata(id: string, metadata: Partial<Document>): Promise<Document | undefined>;
  getDocumentFilePath(id: string): Promise<string | undefined>;
  getDocumentOCRStatus(id: string): Promise<{ status: string; progress?: number } | undefined>;
  startOCRProcessing(id: string): Promise<{ success: boolean; status: string }>;
  addDocumentAnnotation(id: string, annotation: any): Promise<boolean>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocumentOCR(id: string, ocrData: {
    extractedText?: string | null;
    ocrConfidence?: number;
    pages?: number;
    processingTime?: number;
    ocrError?: string;
  }): Promise<void>;
  
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
  getAuditLog(): Promise<AuditLog[]>;
  createAuditEntry(entry: Omit<InsertAuditLog, 'id' | 'timestamp'>): Promise<AuditLog>;

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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const userWithId = { id: nanoid(), ...insertUser };
    const [user] = await db
      .insert(users)
      .values(userWithId)
      .returning();
    return user;
  }

  async getCases(): Promise<Case[]> {
    return await db.select().from(cases).orderBy(desc(cases.updatedAt));
  }

  async getCase(id: string): Promise<Case | undefined> {
    const [case_] = await db.select().from(cases).where(eq(cases.id, id));
    return case_ || undefined;
  }

  async createCase(case_: InsertCase): Promise<Case> {
    const [newCase] = await db
      .insert(cases)
      .values(case_)
      .returning();
    return newCase;
  }

  async updateCase(id: string, updates: Partial<InsertCase>): Promise<Case | undefined> {
    const [updatedCase] = await db
      .update(cases)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cases.id, id))
      .returning();
    return updatedCase || undefined;
  }

  async deleteCase(id: string): Promise<boolean> {
    const result = await db.delete(cases).where(eq(cases.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Documents
  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return document;
  }

  async getDocumentsByCase(caseId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.caseId, caseId));
  }

  async getDocumentMetadata(id: string): Promise<Partial<Document> | undefined> {
    const document = await this.getDocument(id);
    if (!document) return undefined;
    
    // Return metadata without file content
    const { ocrText, ...metadata } = document;
    return metadata;
  }

  async updateDocumentMetadata(id: string, metadata: Partial<Document>): Promise<Document | undefined> {
    const [updated] = await db
      .update(documents)
      .set(metadata)
      .where(eq(documents.id, id))
      .returning();
    return updated;
  }

  async getDocumentFilePath(id: string): Promise<string | undefined> {
    const document = await this.getDocument(id);
    return document?.path;
  }

  async getDocumentOCRStatus(id: string): Promise<{ status: string; progress?: number } | undefined> {
    const document = await this.getDocument(id);
    if (!document) return undefined;
    
    return {
      status: document.ocrText ? 'completed' : 'pending',
      progress: document.ocrText ? 100 : 0,
    };
  }

  async startOCRProcessing(id: string): Promise<{ success: boolean; status: string }> {
    const document = await this.getDocument(id);
    if (!document) return { success: false, status: 'Document not found' };
    
    // TODO: Implement actual OCR processing
    return { success: true, status: 'OCR processing started' };
  }

  async addDocumentAnnotation(id: string, annotation: any): Promise<boolean> {
    // TODO: Implement document annotation system
    return true;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
  }

  async updateDocumentOCR(id: string, ocrData: {
    extractedText?: string | null;
    ocrConfidence?: number;
    pages?: number;
    processingTime?: number;
    ocrError?: string;
  }): Promise<void> {
    await db
      .update(documents)
      .set({
        ocrText: ocrData.extractedText,
        updatedAt: new Date()
      })
      .where(eq(documents.id, id));
  }

  async getEventsByCase(caseId: string): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.caseId, caseId)).orderBy(desc(events.happenedAt));
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db
      .insert(events)
      .values(event)
      .returning();
    return newEvent;
  }

  async getDraftsByCase(caseId: string): Promise<Draft[]> {
    return await db.select().from(drafts).where(eq(drafts.caseId, caseId)).orderBy(desc(drafts.updatedAt));
  }

  async createDraft(draft: InsertDraft): Promise<Draft> {
    const [newDraft] = await db
      .insert(drafts)
      .values(draft)
      .returning();
    return newDraft;
  }

  async getConsentsByPerson(personId: string): Promise<Consent[]> {
    return await db.select().from(consents).where(eq(consents.personId, personId));
  }

  async createConsent(consent: InsertConsent): Promise<Consent> {
    const [newConsent] = await db
      .insert(consents)
      .values(consent)
      .returning();
    return newConsent;
  }

  async getAuditLog(): Promise<AuditLog[]> {
    return await db.select().from(auditLog).orderBy(desc(auditLog.timestamp)).limit(100);
  }

  async createAuditEntry(entry: Omit<InsertAuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const [newEntry] = await db
      .insert(auditLog)
      .values(entry)
      .returning();
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

    const [documentsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents);

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
}

export const storage = new DatabaseStorage();
