import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, vector, boolean, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (existing)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("solicitor"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cases table
export const cases = pgTable("cases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  clientRef: text("client_ref"),
  status: text("status").notNull().default("active"),
  riskLevel: text("risk_level").notNull().default("medium"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Persons table
export const persons = pgTable("persons", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  role: text("role").notNull(), // client, solicitor, opponent, staff
  name: text("name").notNull(),
  contacts: jsonb("contacts"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Documents table
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  type: text("type").notNull(),
  source: text("source").notNull(),
  path: text("path").notNull(),
  hash: text("hash").notNull(),
  ocrText: text("ocr_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Events table
export const events = pgTable("events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  kind: text("kind").notNull(), // hearing, letter, email, call, task
  happenedAt: timestamp("happened_at").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Drafts table
export const drafts = pgTable("drafts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  tone: text("tone").notNull().default("professional"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit log table
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id").notNull(),
  metadata: jsonb("metadata"),
  redactedData: text("redacted_data"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Consents table
export const consents = pgTable("consents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  scope: text("scope").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

// Embeddings table (for RAG)
export const embeddings = pgTable("embeddings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").references(() => documents.id).notNull(),
  chunkIx: integer("chunk_ix").notNull(),
  vector: vector("vector", { dimensions: 384 }),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const casesRelations = relations(cases, ({ many }) => ({
  documents: many(documents),
  events: many(events),
  drafts: many(drafts),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  case: one(cases, {
    fields: [documents.caseId],
    references: [cases.id],
  }),
  embeddings: many(embeddings),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  case: one(cases, {
    fields: [events.caseId],
    references: [cases.id],
  }),
}));

export const draftsRelations = relations(drafts, ({ one }) => ({
  case: one(cases, {
    fields: [drafts.caseId],
    references: [cases.id],
  }),
}));

export const personsRelations = relations(persons, ({ many }) => ({
  consents: many(consents),
}));

export const consentsRelations = relations(consents, ({ one }) => ({
  person: one(persons, {
    fields: [consents.personId],
    references: [persons.id],
  }),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  document: one(documents, {
    fields: [embeddings.documentId],
    references: [documents.id],
  }),
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

export const insertCaseSchema = createInsertSchema(cases).pick({
  title: true,
  clientRef: true,
  status: true,
  riskLevel: true,
  description: true,
}).extend({
  clientRef: z.string().optional(),
  description: z.string().optional(),
});

export const insertPersonSchema = createInsertSchema(persons).pick({
  role: true,
  name: true,
  contacts: true,
  notes: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  caseId: true,
  type: true,
  source: true,
  path: true,
  hash: true,
  ocrText: true,
});

export const insertEventSchema = createInsertSchema(events).pick({
  caseId: true,
  kind: true,
  happenedAt: true,
  data: true,
});

export const insertDraftSchema = createInsertSchema(drafts).pick({
  caseId: true,
  title: true,
  bodyMd: true,
  tone: true,
  status: true,
});

export const insertConsentSchema = createInsertSchema(consents).pick({
  personId: true,
  scope: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLog).pick({
  userId: true,
  action: true,
  resource: true,
  resourceId: true,
  metadata: true,
  redactedData: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;

export type Person = typeof persons.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = z.infer<typeof insertDraftSchema>;

export type Consent = typeof consents.$inferSelect;
export type InsertConsent = z.infer<typeof insertConsentSchema>;

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Embedding = typeof embeddings.$inferSelect;
