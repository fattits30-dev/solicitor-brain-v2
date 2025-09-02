import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table (existing - matches actual database structure)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('solicitor'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Cases table
export const cases = pgTable('cases', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  clientRef: text('client_ref'),
  status: text('status').notNull().default('active'),
  riskLevel: text('risk_level').notNull().default('medium'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Persons table
export const persons = pgTable('persons', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  role: text('role').notNull(), // client, solicitor, opponent, staff
  name: text('name').notNull(),
  contacts: jsonb('contacts'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Documents table
export const documents = pgTable('documents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  caseId: uuid('case_id')
    .references(() => cases.id)
    .notNull(),
  type: text('type').notNull(),
  source: text('source').notNull(),
  path: text('path').notNull(),
  hash: text('hash').notNull(),
  ocrText: text('ocr_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Events table
export const events = pgTable('events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  caseId: uuid('case_id')
    .references(() => cases.id)
    .notNull(),
  kind: text('kind').notNull(), // hearing, letter, email, call, task
  happenedAt: timestamp('happened_at').notNull(),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Drafts table
export const drafts = pgTable('drafts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  caseId: uuid('case_id')
    .references(() => cases.id)
    .notNull(),
  title: text('title').notNull(),
  bodyMd: text('body_md').notNull(),
  tone: text('tone').notNull().default('professional'),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Audit log table
export const auditLog = pgTable('audit_log', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id').notNull(),
  metadata: jsonb('metadata'),
  redactedData: text('redacted_data'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Consents table
export const consents = pgTable('consents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  personId: uuid('person_id')
    .references(() => persons.id)
    .notNull(),
  scope: text('scope').notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
});

// Embeddings table (for RAG)
export const embeddings = pgTable('embeddings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  documentId: uuid('document_id')
    .references(() => documents.id)
    .notNull(),
  chunkIx: integer('chunk_ix').notNull(),
  vector: vector('vector', { dimensions: 384 }),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// MFA Settings table
export const mfaSettings = pgTable('mfa_settings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull()
    .unique(),
  isEnabled: boolean('is_enabled').default(false).notNull(),
  totpSecret: text('totp_secret'), // encrypted
  backupCodes: jsonb('backup_codes'), // array of encrypted codes
  smsPhoneNumber: text('sms_phone_number'), // encrypted
  emailAddress: text('email_address'), // encrypted
  gracePeriodEnd: timestamp('grace_period_end'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Trusted Devices table
export const trustedDevices = pgTable('trusted_devices', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  deviceFingerprint: text('device_fingerprint').notNull(),
  deviceName: text('device_name'),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  lastUsed: timestamp('last_used').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// MFA Attempts table (for rate limiting)
export const mfaAttempts = pgTable('mfa_attempts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  method: text('method').notNull(), // totp, sms, email, backup
  success: boolean('success').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
});

// MFA Recovery Codes table
export const mfaRecoveryCodes = pgTable('mfa_recovery_codes', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  codeHash: text('code_hash').notNull(),
  used: boolean('used').default(false).notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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

export const usersRelations = relations(users, ({ one, many }) => ({
  mfaSettings: one(mfaSettings),
  trustedDevices: many(trustedDevices),
  mfaAttempts: many(mfaAttempts),
  recoveryCodes: many(mfaRecoveryCodes),
}));

export const mfaSettingsRelations = relations(mfaSettings, ({ one }) => ({
  user: one(users, {
    fields: [mfaSettings.userId],
    references: [users.id],
  }),
}));

export const trustedDevicesRelations = relations(trustedDevices, ({ one }) => ({
  user: one(users, {
    fields: [trustedDevices.userId],
    references: [users.id],
  }),
}));

export const mfaAttemptsRelations = relations(mfaAttempts, ({ one }) => ({
  user: one(users, {
    fields: [mfaAttempts.userId],
    references: [users.id],
  }),
}));

export const mfaRecoveryCodesRelations = relations(mfaRecoveryCodes, ({ one }) => ({
  user: one(users, {
    fields: [mfaRecoveryCodes.userId],
    references: [users.id],
  }),
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

export const insertCaseSchema = createInsertSchema(cases)
  .pick({
    title: true,
    clientRef: true,
    status: true,
    riskLevel: true,
    description: true,
  })
  .extend({
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

export const insertAuditLogSchema = createInsertSchema(auditLog)
  .pick({
    userId: true,
    action: true,
    resource: true,
    resourceId: true,
    metadata: true,
    redactedData: true,
  })
  .extend({
    userId: z.string().uuid().nullable(),
  });

export const insertMfaSettingsSchema = createInsertSchema(mfaSettings).pick({
  userId: true,
  isEnabled: true,
  totpSecret: true,
  backupCodes: true,
  smsPhoneNumber: true,
  emailAddress: true,
  gracePeriodEnd: true,
});

export const insertTrustedDeviceSchema = createInsertSchema(trustedDevices).pick({
  userId: true,
  deviceFingerprint: true,
  deviceName: true,
  userAgent: true,
  ipAddress: true,
  expiresAt: true,
});

export const insertMfaAttemptSchema = createInsertSchema(mfaAttempts).pick({
  userId: true,
  method: true,
  success: true,
  ipAddress: true,
  userAgent: true,
});

export const insertMfaRecoveryCodeSchema = createInsertSchema(mfaRecoveryCodes).pick({
  userId: true,
  codeHash: true,
  used: true,
  usedAt: true,
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

export type MfaSettings = typeof mfaSettings.$inferSelect;
export type InsertMfaSettings = z.infer<typeof insertMfaSettingsSchema>;

export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type InsertTrustedDevice = z.infer<typeof insertTrustedDeviceSchema>;

export type MfaAttempt = typeof mfaAttempts.$inferSelect;
export type InsertMfaAttempt = z.infer<typeof insertMfaAttemptSchema>;

export type MfaRecoveryCode = typeof mfaRecoveryCodes.$inferSelect;
export type InsertMfaRecoveryCode = z.infer<typeof insertMfaRecoveryCodeSchema>;

// ============ RBAC TABLES ============

// Roles table
export const roles = pgTable('roles', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Permissions table
export const permissions = pgTable('permissions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Role-Permission junction table
export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  roleId: uuid('role_id')
    .references(() => roles.id, { onDelete: 'cascade' })
    .notNull(),
  permissionId: uuid('permission_id')
    .references(() => permissions.id, { onDelete: 'cascade' })
    .notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  grantedBy: text('granted_by').references(() => users.id),
});

// User-Role junction table
export const userRoles = pgTable('user_roles', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  roleId: uuid('role_id')
    .references(() => roles.id, { onDelete: 'cascade' })
    .notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  assignedBy: text('assigned_by').references(() => users.id),
  expiresAt: timestamp('expires_at'),
});

// RBAC Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  users: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
  grantedByUser: one(users, {
    fields: [rolePermissions.grantedBy],
    references: [users.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
  }),
}));

// Update users relations to include roles
export const usersRelationsUpdated = relations(users, ({ one, many }) => ({
  mfaSettings: one(mfaSettings),
  trustedDevices: many(trustedDevices),
  mfaAttempts: many(mfaAttempts),
  recoveryCodes: many(mfaRecoveryCodes),
  userRoles: many(userRoles),
}));

// RBAC Schemas for validation
export const insertRoleSchema = createInsertSchema(roles).pick({
  name: true,
  description: true,
  isActive: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).pick({
  name: true,
  resource: true,
  action: true,
  description: true,
  isActive: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).pick({
  roleId: true,
  permissionId: true,
  grantedBy: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).pick({
  userId: true,
  roleId: true,
  assignedBy: true,
  expiresAt: true,
});

// RBAC Types
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
