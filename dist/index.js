var __defProp = Object.defineProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express4 from "express";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLog: () => auditLog,
  cases: () => cases,
  casesRelations: () => casesRelations,
  consents: () => consents,
  consentsRelations: () => consentsRelations,
  documents: () => documents,
  documentsRelations: () => documentsRelations,
  drafts: () => drafts,
  draftsRelations: () => draftsRelations,
  embeddings: () => embeddings,
  embeddingsRelations: () => embeddingsRelations,
  events: () => events,
  eventsRelations: () => eventsRelations,
  insertAuditLogSchema: () => insertAuditLogSchema,
  insertCaseSchema: () => insertCaseSchema,
  insertConsentSchema: () => insertConsentSchema,
  insertDocumentSchema: () => insertDocumentSchema,
  insertDraftSchema: () => insertDraftSchema,
  insertEventSchema: () => insertEventSchema,
  insertMfaAttemptSchema: () => insertMfaAttemptSchema,
  insertMfaRecoveryCodeSchema: () => insertMfaRecoveryCodeSchema,
  insertMfaSettingsSchema: () => insertMfaSettingsSchema,
  insertPermissionSchema: () => insertPermissionSchema,
  insertPersonSchema: () => insertPersonSchema,
  insertRolePermissionSchema: () => insertRolePermissionSchema,
  insertRoleSchema: () => insertRoleSchema,
  insertTrustedDeviceSchema: () => insertTrustedDeviceSchema,
  insertUserRoleSchema: () => insertUserRoleSchema,
  insertUserSchema: () => insertUserSchema,
  mfaAttempts: () => mfaAttempts,
  mfaAttemptsRelations: () => mfaAttemptsRelations,
  mfaRecoveryCodes: () => mfaRecoveryCodes,
  mfaRecoveryCodesRelations: () => mfaRecoveryCodesRelations,
  mfaSettings: () => mfaSettings,
  mfaSettingsRelations: () => mfaSettingsRelations,
  permissions: () => permissions,
  permissionsRelations: () => permissionsRelations,
  persons: () => persons,
  personsRelations: () => personsRelations,
  rolePermissions: () => rolePermissions,
  rolePermissionsRelations: () => rolePermissionsRelations,
  roles: () => roles,
  rolesRelations: () => rolesRelations,
  trustedDevices: () => trustedDevices,
  trustedDevicesRelations: () => trustedDevicesRelations,
  userRoles: () => userRoles,
  userRolesRelations: () => userRolesRelations,
  users: () => users,
  usersRelations: () => usersRelations,
  usersRelationsUpdated: () => usersRelationsUpdated
});
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("solicitor"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var cases = pgTable("cases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  clientRef: text("client_ref"),
  status: text("status").notNull().default("active"),
  riskLevel: text("risk_level").notNull().default("medium"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var persons = pgTable("persons", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  role: text("role").notNull(),
  // client, solicitor, opponent, staff
  name: text("name").notNull(),
  contacts: jsonb("contacts"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  type: text("type").notNull(),
  source: text("source").notNull(),
  path: text("path").notNull(),
  hash: text("hash").notNull(),
  ocrText: text("ocr_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var events = pgTable("events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  kind: text("kind").notNull(),
  // hearing, letter, email, call, task
  happenedAt: timestamp("happened_at").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var drafts = pgTable("drafts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  tone: text("tone").notNull().default("professional"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id").notNull(),
  metadata: jsonb("metadata"),
  redactedData: text("redacted_data"),
  timestamp: timestamp("timestamp").defaultNow().notNull()
});
var consents = pgTable("consents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  scope: text("scope").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at")
});
var embeddings = pgTable("embeddings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").references(() => documents.id).notNull(),
  chunkIx: integer("chunk_ix").notNull(),
  vector: vector("vector", { dimensions: 384 }),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var mfaSettings = pgTable("mfa_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  totpSecret: text("totp_secret"),
  // encrypted
  backupCodes: jsonb("backup_codes"),
  // array of encrypted codes
  smsPhoneNumber: text("sms_phone_number"),
  // encrypted
  emailAddress: text("email_address"),
  // encrypted
  gracePeriodEnd: timestamp("grace_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var trustedDevices = pgTable("trusted_devices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  deviceFingerprint: text("device_fingerprint").notNull(),
  deviceName: text("device_name"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  lastUsed: timestamp("last_used").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var mfaAttempts = pgTable("mfa_attempts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  method: text("method").notNull(),
  // totp, sms, email, backup
  success: boolean("success").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull()
});
var mfaRecoveryCodes = pgTable("mfa_recovery_codes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  codeHash: text("code_hash").notNull(),
  used: boolean("used").default(false).notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var casesRelations = relations(cases, ({ many }) => ({
  documents: many(documents),
  events: many(events),
  drafts: many(drafts)
}));
var documentsRelations = relations(documents, ({ one, many }) => ({
  case: one(cases, {
    fields: [documents.caseId],
    references: [cases.id]
  }),
  embeddings: many(embeddings)
}));
var eventsRelations = relations(events, ({ one }) => ({
  case: one(cases, {
    fields: [events.caseId],
    references: [cases.id]
  })
}));
var draftsRelations = relations(drafts, ({ one }) => ({
  case: one(cases, {
    fields: [drafts.caseId],
    references: [cases.id]
  })
}));
var personsRelations = relations(persons, ({ many }) => ({
  consents: many(consents)
}));
var consentsRelations = relations(consents, ({ one }) => ({
  person: one(persons, {
    fields: [consents.personId],
    references: [persons.id]
  })
}));
var embeddingsRelations = relations(embeddings, ({ one }) => ({
  document: one(documents, {
    fields: [embeddings.documentId],
    references: [documents.id]
  })
}));
var usersRelations = relations(users, ({ one, many }) => ({
  mfaSettings: one(mfaSettings),
  trustedDevices: many(trustedDevices),
  mfaAttempts: many(mfaAttempts),
  recoveryCodes: many(mfaRecoveryCodes)
}));
var mfaSettingsRelations = relations(mfaSettings, ({ one }) => ({
  user: one(users, {
    fields: [mfaSettings.userId],
    references: [users.id]
  })
}));
var trustedDevicesRelations = relations(trustedDevices, ({ one }) => ({
  user: one(users, {
    fields: [trustedDevices.userId],
    references: [users.id]
  })
}));
var mfaAttemptsRelations = relations(mfaAttempts, ({ one }) => ({
  user: one(users, {
    fields: [mfaAttempts.userId],
    references: [users.id]
  })
}));
var mfaRecoveryCodesRelations = relations(mfaRecoveryCodes, ({ one }) => ({
  user: one(users, {
    fields: [mfaRecoveryCodes.userId],
    references: [users.id]
  })
}));
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true
});
var insertCaseSchema = createInsertSchema(cases).pick({
  title: true,
  clientRef: true,
  status: true,
  riskLevel: true,
  description: true
}).extend({
  clientRef: z.string().optional(),
  description: z.string().optional()
});
var insertPersonSchema = createInsertSchema(persons).pick({
  role: true,
  name: true,
  contacts: true,
  notes: true
});
var insertDocumentSchema = createInsertSchema(documents).pick({
  caseId: true,
  type: true,
  source: true,
  path: true,
  hash: true,
  ocrText: true
});
var insertEventSchema = createInsertSchema(events).pick({
  caseId: true,
  kind: true,
  happenedAt: true,
  data: true
});
var insertDraftSchema = createInsertSchema(drafts).pick({
  caseId: true,
  title: true,
  bodyMd: true,
  tone: true,
  status: true
});
var insertConsentSchema = createInsertSchema(consents).pick({
  personId: true,
  scope: true
});
var insertAuditLogSchema = createInsertSchema(auditLog).pick({
  userId: true,
  action: true,
  resource: true,
  resourceId: true,
  metadata: true,
  redactedData: true
}).extend({
  userId: z.string().uuid().nullable()
});
var insertMfaSettingsSchema = createInsertSchema(mfaSettings).pick({
  userId: true,
  isEnabled: true,
  totpSecret: true,
  backupCodes: true,
  smsPhoneNumber: true,
  emailAddress: true,
  gracePeriodEnd: true
});
var insertTrustedDeviceSchema = createInsertSchema(trustedDevices).pick({
  userId: true,
  deviceFingerprint: true,
  deviceName: true,
  userAgent: true,
  ipAddress: true,
  expiresAt: true
});
var insertMfaAttemptSchema = createInsertSchema(mfaAttempts).pick({
  userId: true,
  method: true,
  success: true,
  ipAddress: true,
  userAgent: true
});
var insertMfaRecoveryCodeSchema = createInsertSchema(mfaRecoveryCodes).pick({
  userId: true,
  codeHash: true,
  used: true,
  usedAt: true
});
var roles = pgTable("roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  grantedBy: text("granted_by").references(() => users.id)
});
var userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: text("assigned_by").references(() => users.id),
  expiresAt: timestamp("expires_at")
});
var rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  users: many(userRoles)
}));
var permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions)
}));
var rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id]
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id]
  }),
  grantedByUser: one(users, {
    fields: [rolePermissions.grantedBy],
    references: [users.id]
  })
}));
var userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id]
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id]
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id]
  })
}));
var usersRelationsUpdated = relations(users, ({ one, many }) => ({
  mfaSettings: one(mfaSettings),
  trustedDevices: many(trustedDevices),
  mfaAttempts: many(mfaAttempts),
  recoveryCodes: many(mfaRecoveryCodes),
  userRoles: many(userRoles)
}));
var insertRoleSchema = createInsertSchema(roles).pick({
  name: true,
  description: true,
  isActive: true
});
var insertPermissionSchema = createInsertSchema(permissions).pick({
  name: true,
  resource: true,
  action: true,
  description: true,
  isActive: true
});
var insertRolePermissionSchema = createInsertSchema(rolePermissions).pick({
  roleId: true,
  permissionId: true,
  grantedBy: true
});
var insertUserRoleSchema = createInsertSchema(userRoles).pick({
  userId: true,
  roleId: true,
  assignedBy: true,
  expiresAt: true
});

// server/routes.ts
import { createServer } from "http";
import { z as z5 } from "zod";

// server/utils/audit-logger.ts
import { sql as sql2 } from "drizzle-orm";
import { appendFileSync, existsSync as existsSync2, mkdirSync, renameSync, statSync } from "fs";
import path2 from "path";

// server/db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
dotenv.config();
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle(pool, { schema: schema_exports });

// server/services/pii-redactor.ts
import * as crypto from "crypto";
var PIIRedactionService = class {
  constructor(config) {
    this.rules = [];
    this.config = {
      defaultLevel: "FULL" /* FULL */,
      roleBasedLevels: {
        admin: "NONE" /* NONE */,
        senior_solicitor: "PARTIAL" /* PARTIAL */,
        solicitor: "PARTIAL" /* PARTIAL */,
        paralegal: "FULL" /* FULL */,
        support: "FULL" /* FULL */
      },
      exemptedFields: [],
      environmentOverrides: {
        development: "PARTIAL" /* PARTIAL */,
        staging: "FULL" /* FULL */,
        production: "FULL" /* FULL */
      },
      logRedactions: true,
      preserveFormat: true,
      ...config
    };
    this.hashSalt = process.env.PII_REDACTION_SALT || "solicitor-brain-v2-redaction";
    this.initializeDefaultRules();
  }
  initializeDefaultRules() {
    this.addRule({
      id: "uk-names",
      name: "UK Names",
      // Bounded repetition to reduce catastrophic backtracking while supporting first+last (+middle) names.
      pattern: /\b[A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{2,15}){1,2}\b/g,
      category: "PII",
      severity: "HIGH",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[NAME_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => {
          const parts = match.split(" ");
          if (parts.length === 1) return match.charAt(0) + "***";
          return parts[0].charAt(0) + "*** " + parts[parts.length - 1].charAt(0) + "***";
        },
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "NAME"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "uk-ni-number",
      name: "UK National Insurance Numbers",
      pattern: /\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z][\s]?[0-9]{2}[\s]?[0-9]{2}[\s]?[0-9]{2}[\s]?[A-D]\b/gi,
      category: "IDENTIFIER",
      severity: "CRITICAL",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[NI_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => {
          const clean = match.replace(/\s/g, "");
          return clean.substring(0, 2) + "XX XX XX X";
        },
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "NI"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "uk-postcode",
      name: "UK Postcodes",
      pattern: /\b[A-Z]{1,2}[0-9R][0-9A-Z]?[\s]?[0-9][A-Z]{2}\b/gi,
      category: "PII",
      severity: "MEDIUM",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[POSTCODE_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => {
          const clean = match.replace(/\s/g, "");
          return clean.substring(0, 2) + "X XXX";
        },
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "POST"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "uk-phone",
      name: "UK Phone Numbers",
      pattern: /(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}|(\+44\s?1\d{3}|\(?01\d{3}\)?)\s?\d{3}\s?\d{3}|(\+44\s?2\d|\(?02\d)\s?\d{3}\s?\d{4}/g,
      category: "CONTACT",
      severity: "HIGH",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[PHONE_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => {
          if (match.includes("+44")) return "+44 XXXX XXXXXX";
          if (match.startsWith("07")) return "07XXX XXXXXX";
          return "XXXX XXXXXX";
        },
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "PHONE"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "email",
      name: "Email Addresses",
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      category: "CONTACT",
      severity: "HIGH",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[EMAIL_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => {
          const [local, domain] = match.split("@");
          return local.substring(0, 2) + "***@" + domain;
        },
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "EMAIL"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "uk-address",
      name: "UK Addresses",
      pattern: /\d+\s+[A-Za-z\s]+(Street|St|Road|Rd|Lane|Ln|Avenue|Ave|Drive|Dr|Close|Cl|Place|Pl|Way|Court|Ct|Gardens|Gdns|Crescent|Cres|Square|Sq|Terrace|Ter)/gi,
      category: "PII",
      severity: "MEDIUM",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[ADDRESS_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => {
          const parts = match.split(" ");
          return "XX " + parts[parts.length - 1];
        },
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "ADDR"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "date-of-birth",
      name: "Dates of Birth",
      pattern: /\b(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g,
      category: "PII",
      severity: "HIGH",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[DOB_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => {
          if (match.includes("/")) return "XX/XX/XXXX";
          if (match.includes("-")) return "XX-XX-XXXX";
          return "XXXXXXXX";
        },
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "DOB"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "uk-bank-account",
      name: "UK Bank Account Numbers",
      pattern: /\b\d{8}\b/g,
      category: "FINANCIAL",
      severity: "CRITICAL",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[ACCOUNT_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => "XXXX" + match.slice(-4),
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "BANK"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "uk-sort-code",
      name: "UK Sort Codes",
      pattern: /\b\d{2}[-\s]?\d{2}[-\s]?\d{2}\b/g,
      category: "FINANCIAL",
      severity: "CRITICAL",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[SORT_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (_match) => "XX-XX-XX",
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "SORT"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "case-reference",
      name: "Case Reference Numbers",
      pattern: /\b(CASE|REF|CR|SB)[-_\s]?[A-Z0-9]{4,12}\b/gi,
      category: "LEGAL",
      severity: "MEDIUM",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[CASE_REF_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => {
          const parts = match.split(/[-_\s]/);
          if (parts.length > 1) return parts[0] + "-XXXX";
          return match.substring(0, 4) + "XXXX";
        },
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "CASE"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "jwt-token",
      name: "JWT Tokens",
      pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
      category: "IDENTIFIER",
      severity: "CRITICAL",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[JWT_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (_match) => "eyJ...[TRUNCATED]",
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "JWT"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "credit-card",
      name: "Credit Card Numbers",
      pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
      category: "FINANCIAL",
      severity: "CRITICAL",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[CARD_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => "XXXX-XXXX-XXXX-" + match.slice(-4),
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "CARD"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
    this.addRule({
      id: "uk-passport",
      name: "UK Passport Numbers",
      pattern: /\b[0-9]{9}\b/g,
      category: "IDENTIFIER",
      severity: "CRITICAL",
      enabled: true,
      replacement: {
        ["FULL" /* FULL */]: "[PASSPORT_REDACTED]",
        ["PARTIAL" /* PARTIAL */]: (match) => "XXXXX" + match.slice(-4),
        ["HASH" /* HASH */]: (match) => this.generateHash(match, "PASS"),
        ["NONE" /* NONE */]: (match) => match
      }
    });
  }
  addRule(rule) {
    this.rules.push(rule);
  }
  generateHash(input, prefix = "HASH") {
    const hash = crypto.createHash("sha256").update(input + this.hashSalt).digest("hex").substring(0, 8);
    return `[${prefix}_${hash.toUpperCase()}]`;
  }
  /**
   * Redact PII from text based on user role and configuration
   */
  redact(text2, userRole, level, exemptedFields = []) {
    if (!text2 || typeof text2 !== "string") {
      return {
        originalText: text2 || "",
        redactedText: text2 || "",
        redactionsApplied: [],
        level: level || this.config.defaultLevel,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const effectiveLevel = this.determineRedactionLevel(userRole, level);
    if (effectiveLevel === "NONE" /* NONE */) {
      return {
        originalText: text2,
        redactedText: text2,
        redactionsApplied: [],
        level: effectiveLevel,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    let redactedText = text2;
    const redactionsApplied = [];
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (exemptedFields.includes(rule.category)) continue;
      const matches = Array.from(text2.matchAll(rule.pattern));
      if (matches.length === 0) continue;
      const positions = [];
      const sortedMatches = matches.reverse();
      for (const match of sortedMatches) {
        if (!match.index) continue;
        const original = match[0];
        const replacement = rule.replacement[effectiveLevel];
        const redacted = typeof replacement === "function" ? replacement(original) : replacement;
        positions.unshift({
          start: match.index,
          end: match.index + original.length,
          original,
          redacted
        });
        redactedText = redactedText.substring(0, match.index) + redacted + redactedText.substring(match.index + original.length);
      }
      if (positions.length > 0) {
        redactionsApplied.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          matchCount: matches.length,
          positions
        });
      }
    }
    const result = {
      originalText: text2,
      redactedText,
      redactionsApplied,
      level: effectiveLevel,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.config.logRedactions && redactionsApplied.length > 0) {
      this.logRedaction(result);
    }
    return result;
  }
  /**
   * Redact PII from objects recursively
   */
  redactObject(obj, userRole, level, exemptedFields = []) {
    if (!obj || typeof obj !== "object") {
      return { redacted: obj, summary: [] };
    }
    const summary = [];
    const redacted = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
      if (exemptedFields.includes(key)) {
        redacted[key] = value;
        continue;
      }
      if (typeof value === "string") {
        const result = this.redact(value, userRole, level, exemptedFields);
        redacted[key] = result.redactedText;
        if (result.redactionsApplied.length > 0) {
          summary.push(result);
        }
      } else if (typeof value === "object" && value !== null) {
        const nested = this.redactObject(value, userRole, level, exemptedFields);
        redacted[key] = nested.redacted;
        summary.push(...nested.summary);
      } else {
        redacted[key] = value;
      }
    }
    return { redacted, summary };
  }
  /**
   * Check if text contains PII without redacting
   */
  containsPII(text2) {
    if (!text2 || typeof text2 !== "string") {
      return { hasPII: false, categories: [], severities: [], ruleMatches: [] };
    }
    const ruleMatches = [];
    const categories = /* @__PURE__ */ new Set();
    const severities = /* @__PURE__ */ new Set();
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      const matches = text2.match(rule.pattern);
      if (matches && matches.length > 0) {
        ruleMatches.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          matches: matches.length
        });
        categories.add(rule.category);
        severities.add(rule.severity);
      }
    }
    return {
      hasPII: ruleMatches.length > 0,
      categories: Array.from(categories),
      severities: Array.from(severities),
      ruleMatches
    };
  }
  /**
   * Get redaction statistics
   */
  getStats() {
    const stats = {
      totalRules: this.rules.length,
      enabledRules: this.rules.filter((r) => r.enabled).length,
      rulesByCategory: {},
      rulesBySeverity: {}
    };
    for (const rule of this.rules) {
      stats.rulesByCategory[rule.category] = (stats.rulesByCategory[rule.category] || 0) + 1;
      stats.rulesBySeverity[rule.severity] = (stats.rulesBySeverity[rule.severity] || 0) + 1;
    }
    return stats;
  }
  /**
   * Enable/disable specific rules
   */
  setRuleStatus(ruleId, enabled) {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }
  /**
   * Add custom redaction rule
   */
  addCustomRule(rule) {
    if (!rule.id || !rule.name || !rule.pattern) {
      throw new Error("Invalid redaction rule: missing required fields");
    }
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Redaction rule with ID '${rule.id}' already exists`);
    }
    this.addRule(rule);
  }
  /**
   * Get rule by ID
   */
  getRule(ruleId) {
    return this.rules.find((r) => r.id === ruleId);
  }
  /**
   * Get all rules
   */
  getAllRules() {
    return [...this.rules];
  }
  determineRedactionLevel(userRole, explicitLevel) {
    if (explicitLevel) {
      return explicitLevel;
    }
    const env = process.env.NODE_ENV || "development";
    if (this.config.environmentOverrides[env]) {
      return this.config.environmentOverrides[env];
    }
    if (userRole && this.config.roleBasedLevels[userRole]) {
      return this.config.roleBasedLevels[userRole];
    }
    return this.config.defaultLevel;
  }
  logRedaction(result) {
    console.log(
      `[PII_REDACTION] Level: ${result.level}, Rules Applied: ${result.redactionsApplied.length}`
    );
    for (const redaction of result.redactionsApplied) {
      console.log(
        `  - ${redaction.ruleId} (${redaction.category}/${redaction.severity}): ${redaction.matchCount} matches`
      );
    }
  }
  /**
   * Create middleware for Express.js logging
   */
  createLoggingMiddleware() {
    return (req, res, next) => {
      const originalSend = res.send;
      const originalJson = res.json;
      if (req.body) {
        const userRole = req.user?.role || "guest";
        const { redacted } = this.redactObject(req.body, userRole);
        req.redactedBody = redacted;
      }
      res.send = function(body) {
        if (typeof body === "string") {
          const userRole = req.user?.role || "guest";
          const result = piiRedactor.redact(body, userRole);
          return originalSend.call(this, result.redactedText);
        }
        return originalSend.call(this, body);
      };
      res.json = function(body) {
        if (body && typeof body === "object") {
          const userRole = req.user?.role || "guest";
          const { redacted } = piiRedactor.redactObject(body, userRole);
          return originalJson.call(this, redacted);
        }
        return originalJson.call(this, body);
      };
      next();
    };
  }
  /**
   * Create error handler middleware with redaction
   */
  createErrorMiddleware() {
    return (error, req, res, _next) => {
      const userRole = req.user?.role || "guest";
      const redactedMessage = this.redact(error.message || "An error occurred", userRole);
      let redactedStack = error.stack;
      if (userRole !== "admin") {
        redactedStack = this.redact(error.stack || "", userRole).redactedText;
      }
      const errorResponse = {
        error: redactedMessage.redactedText,
        ...process.env.NODE_ENV === "development" && { stack: redactedStack }
      };
      res.status(error.status || 500).json(errorResponse);
    };
  }
};
var piiRedactor = new PIIRedactionService();

// server/utils/dev-security.ts
import crypto2 from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
var DevelopmentSecurity = class {
  constructor() {
    this.sensitivePatterns = [
      // Authentication tokens
      {
        pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
        replacement: "Bearer [REDACTED]",
        description: "JWT/Bearer tokens"
      },
      {
        pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
        replacement: "[JWT_REDACTED]",
        description: "JWT tokens"
      },
      // API Keys
      {
        pattern: /api[_-]?key[\s]*[:=][\s]*["']?[A-Za-z0-9\-._]+["']?/gi,
        replacement: "api_key=[REDACTED]",
        description: "API keys"
      },
      // Passwords
      {
        pattern: /password[\s]*[:=][\s]*["']?[^"'\s]+["']?/gi,
        replacement: "password=[REDACTED]",
        description: "Passwords"
      },
      // Database URLs
      {
        pattern: /postgresql:\/\/[^@]+@[^\s]+/gi,
        replacement: "postgresql://[REDACTED]@[REDACTED]",
        description: "PostgreSQL URLs"
      },
      {
        pattern: /redis:\/\/[^@]+@[^\s]+/gi,
        replacement: "redis://[REDACTED]",
        description: "Redis URLs"
      },
      // Email addresses (PII)
      {
        pattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
        replacement: (match) => {
          const [local, domain] = match.split("@");
          return `${local.substring(0, 2)}***@${domain}`;
        },
        description: "Email addresses"
      },
      // UK Phone numbers
      {
        pattern: /(\+44|0)[\s]?[1-9][\s]?[\d\s]{8,10}/g,
        replacement: "+44XXXXXXXXXX",
        description: "UK phone numbers"
      },
      // UK National Insurance numbers
      {
        pattern: /[A-Z]{2}[\s]?[\d]{2}[\s]?[\d]{2}[\s]?[\d]{2}[\s]?[A-Z]/gi,
        replacement: "NI_[REDACTED]",
        description: "National Insurance numbers"
      },
      // Credit card numbers
      {
        pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
        replacement: "XXXX-XXXX-XXXX-XXXX",
        description: "Credit card numbers"
      },
      // AWS credentials
      {
        pattern: /AKIA[0-9A-Z]{16}/g,
        replacement: "AKIA[REDACTED]",
        description: "AWS Access Key IDs"
      },
      // Private keys
      {
        pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+ PRIVATE KEY-----/g,
        replacement: "-----BEGIN PRIVATE KEY-----\n[REDACTED]\n-----END PRIVATE KEY-----",
        description: "Private keys"
      }
    ];
    this.protectedFiles = [
      ".env",
      ".env.local",
      ".env.production",
      "config/secrets.json",
      "config/credentials.json"
    ];
  }
  /**
   * Redact sensitive information from a string
   */
  redactSensitiveData(input) {
    let redacted = input;
    for (const { pattern, replacement } of this.sensitivePatterns) {
      if (typeof replacement === "string") {
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
  checkFileForSensitiveData(filePath) {
    if (!existsSync(filePath)) {
      return { hasSensitive: false, matches: [] };
    }
    const content = readFileSync(filePath, "utf-8");
    const matches = [];
    for (const { pattern, description } of this.sensitivePatterns) {
      const found = content.match(pattern);
      if (found && found.length > 0) {
        matches.push(`Found ${description}: ${found.length} occurrence(s)`);
      }
    }
    return {
      hasSensitive: matches.length > 0,
      matches
    };
  }
  /**
   * Generate secure random secrets
   */
  generateSecret(length = 32) {
    return crypto2.randomBytes(length).toString("hex");
  }
  /**
   * Generate secure JWT secret
   */
  generateJWTSecret() {
    return this.generateSecret(64);
  }
  /**
   * Hash sensitive data for logging
   */
  hashForLogging(data) {
    return crypto2.createHash("sha256").update(data).digest("hex").substring(0, 8);
  }
  /**
   * Check if environment is properly secured
   */
  checkEnvironmentSecurity() {
    const issues = [];
    if (!existsSync(".env")) {
      issues.push("Missing .env file");
    }
    const env = process.env;
    if (env.JWT_SECRET === "your-jwt-secret-here") {
      issues.push("Using default JWT_SECRET");
    }
    if (env.SESSION_SECRET === "your-secure-session-secret-here") {
      issues.push("Using default SESSION_SECRET");
    }
    if (env.DATABASE_URL?.includes("user:password")) {
      issues.push("Using default database credentials");
    }
    for (const file of this.protectedFiles) {
      if (existsSync(file)) {
        const stats = __require("fs").statSync(file);
        const mode = (stats.mode & parseInt("777", 8)).toString(8);
        if (mode !== "600" && mode !== "400") {
          issues.push(`Insecure permissions on ${file}: ${mode} (should be 600 or 400)`);
        }
      }
    }
    if (process.getuid && process.getuid() === 0) {
      issues.push("Running as root user - security risk");
    }
    return {
      secure: issues.length === 0,
      issues
    };
  }
  /**
   * Create a secure development certificate
   */
  generateDevCertificate() {
    return {
      key: "-----BEGIN PRIVATE KEY-----\n[Dev Key - Generate with openssl]\n-----END PRIVATE KEY-----",
      cert: "-----BEGIN CERTIFICATE-----\n[Dev Cert - Generate with openssl]\n-----END CERTIFICATE-----"
    };
  }
  /**
   * Sanitize user input
   */
  sanitizeInput(input) {
    let sanitized = input.replace(/\0/g, "");
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    sanitized = sanitized.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/\//g, "&#x2F;");
    return sanitized;
  }
  /**
   * Validate file upload
   */
  validateFileUpload(filePath, allowedTypes = ["pdf", "doc", "docx", "txt"], maxSize = 10 * 1024 * 1024) {
    if (!existsSync(filePath)) {
      return { valid: false, error: "File not found" };
    }
    const stats = __require("fs").statSync(filePath);
    if (stats.size > maxSize) {
      return { valid: false, error: `File too large: ${stats.size} bytes (max: ${maxSize})` };
    }
    const ext = path.extname(filePath).toLowerCase().substring(1);
    if (!allowedTypes.includes(ext)) {
      return { valid: false, error: `Invalid file type: ${ext}` };
    }
    const dangerousExtensions = ["exe", "dll", "sh", "bat", "cmd", "app"];
    if (dangerousExtensions.includes(ext)) {
      return { valid: false, error: "Executable files not allowed" };
    }
    return { valid: true };
  }
};
var devSecurity = new DevelopmentSecurity();

// server/utils/audit-logger.ts
var AuditLogger = class {
  constructor(options = {}) {
    this.auditDir = path2.join(process.cwd(), "logs", "audit");
    this.maxFileSize = 10 * 1024 * 1024;
    // 10MB
    this.buffer = [];
    this.flushInterval = null;
    this.enableDatabase = options.enableDatabase ?? true;
    this.enableFiles = options.enableFiles ?? true;
    if (this.enableFiles) {
      this.ensureAuditDirectory();
    }
    this.startFlushInterval();
  }
  ensureAuditDirectory() {
    if (!existsSync2(this.auditDir)) {
      mkdirSync(this.auditDir, { recursive: true });
    }
  }
  startFlushInterval() {
    this.flushInterval = setInterval(async () => {
      await this.flushBuffer();
    }, 5e3);
  }
  getCurrentLogFile() {
    const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    return path2.join(this.auditDir, `audit-${date}.jsonl`);
  }
  rotateLogFileIfNeeded() {
    const logFile = this.getCurrentLogFile();
    if (existsSync2(logFile)) {
      const stats = statSync(logFile);
      if (stats.size > this.maxFileSize) {
        const timestamp2 = Date.now();
        const rotatedFile = logFile.replace(".jsonl", `-${timestamp2}.jsonl`);
        renameSync(logFile, rotatedFile);
      }
    }
  }
  sanitizeEntry(entry) {
    const sanitized = { ...entry };
    if (sanitized.details) {
      const { redacted } = piiRedactor.redactObject(sanitized.details, "audit-logger");
      sanitized.details = redacted;
    }
    if (sanitized.errorMessage) {
      const result = piiRedactor.redact(sanitized.errorMessage, "audit-logger");
      sanitized.errorMessage = result.redactedText;
    }
    if (sanitized.stackTrace) {
      const result = piiRedactor.redact(sanitized.stackTrace, "audit-logger");
      sanitized.stackTrace = result.redactedText;
    }
    if (sanitized.details) {
      const detailsStr = JSON.stringify(sanitized.details);
      const legacyRedacted = devSecurity.redactSensitiveData(detailsStr);
      sanitized.details = JSON.parse(legacyRedacted);
    }
    return sanitized;
  }
  writeToFile(entry) {
    if (!this.enableFiles) return;
    this.rotateLogFileIfNeeded();
    const logFile = this.getCurrentLogFile();
    const sanitized = this.sanitizeEntry(entry);
    const line = JSON.stringify(sanitized) + "\n";
    try {
      appendFileSync(logFile, line, "utf-8");
    } catch (error) {
      console.error("Failed to write audit log to file:", error);
    }
  }
  async writeToDatabase(entry) {
    if (!this.enableDatabase) return;
    try {
      const sanitized = this.sanitizeEntry(entry);
      const dbEntry = {
        userId: sanitized.userId && sanitized.userId !== "anonymous" ? sanitized.userId : null,
        action: `${sanitized.eventType}:${sanitized.action || "unknown"}`,
        resource: sanitized.resource || "system",
        resourceId: sanitized.details?.resourceId || sanitized.details?.id || "unknown",
        metadata: {
          eventType: sanitized.eventType,
          severity: sanitized.severity,
          result: sanitized.result,
          sessionId: sanitized.sessionId,
          ipAddress: sanitized.ipAddress,
          userAgent: sanitized.userAgent,
          correlationId: sanitized.correlationId,
          beforeState: sanitized.beforeState,
          afterState: sanitized.afterState,
          details: sanitized.details,
          errorMessage: sanitized.errorMessage,
          stackTrace: sanitized.stackTrace,
          timestamp: sanitized.timestamp
        },
        redactedData: sanitized.details ? JSON.stringify(sanitized.details) : null
      };
      await db.insert(auditLog).values(dbEntry);
    } catch (error) {
      console.error("Failed to write audit log to database:", error);
      if (this.enableFiles) {
        this.writeToFile(entry);
      }
    }
  }
  async flushBuffer() {
    if (this.buffer.length === 0) return;
    const entries = [...this.buffer];
    this.buffer = [];
    const promises = entries.map(async (entry) => {
      try {
        if (this.enableDatabase) {
          await this.writeToDatabase(entry);
        } else if (this.enableFiles) {
          this.writeToFile(entry);
        }
      } catch (error) {
        console.error("Failed to flush audit entry:", error);
        if (this.enableFiles && this.enableDatabase) {
          this.writeToFile(entry);
        }
      }
    });
    await Promise.allSettled(promises);
  }
  log(eventType, severity, result, details) {
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventType,
      severity,
      result,
      correlationId: details?.correlationId || this.generateCorrelationId(),
      ...details
    };
    this.buffer.push(entry);
    if (severity === "CRITICAL" /* CRITICAL */) {
      this.flushBuffer().catch(console.error);
    }
    if (process.env.NODE_ENV === "development") {
      this.logToConsole(entry);
    }
  }
  generateCorrelationId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  logToConsole(entry) {
    const color = {
      ["INFO" /* INFO */]: "\x1B[36m",
      // Cyan
      ["WARNING" /* WARNING */]: "\x1B[33m",
      // Yellow
      ["ERROR" /* ERROR */]: "\x1B[31m",
      // Red
      ["CRITICAL" /* CRITICAL */]: "\x1B[35m"
      // Magenta
    }[entry.severity];
    const reset = "\x1B[0m";
    console.log(
      `${color}[AUDIT]${reset} ${entry.timestamp} | ${entry.severity} | ${entry.eventType} | ${entry.result}`
    );
    if (entry.details) {
      console.log("  Details:", entry.details);
    }
  }
  // Convenience methods for common events
  logLogin(userId, success, ipAddress) {
    this.log(
      success ? "LOGIN_SUCCESS" /* LOGIN_SUCCESS */ : "LOGIN_FAILURE" /* LOGIN_FAILURE */,
      success ? "INFO" /* INFO */ : "WARNING" /* WARNING */,
      success ? "SUCCESS" : "FAILURE",
      { userId, ipAddress }
    );
  }
  logDataAccess(userId, resource, action, success) {
    const eventType = {
      CREATE: "DATA_CREATE" /* DATA_CREATE */,
      READ: "DATA_READ" /* DATA_READ */,
      UPDATE: "DATA_UPDATE" /* DATA_UPDATE */,
      DELETE: "DATA_DELETE" /* DATA_DELETE */
    }[action];
    this.log(
      eventType,
      success ? "INFO" /* INFO */ : "WARNING" /* WARNING */,
      success ? "SUCCESS" : "FAILURE",
      { userId, resource, action }
    );
  }
  logSecurityEvent(type, details) {
    const eventType = {
      RATE_LIMIT: "RATE_LIMIT_EXCEEDED" /* RATE_LIMIT_EXCEEDED */,
      SUSPICIOUS: "SUSPICIOUS_ACTIVITY" /* SUSPICIOUS_ACTIVITY */,
      ALERT: "SECURITY_ALERT" /* SECURITY_ALERT */
    }[type];
    this.log(eventType, "WARNING" /* WARNING */, "FAILURE", { details });
  }
  logError(error, userId, context) {
    this.log("ERROR" /* ERROR */, "ERROR" /* ERROR */, "FAILURE", {
      userId,
      errorMessage: error.message,
      stackTrace: error.stack,
      details: context
    });
  }
  logGDPREvent(type, userId, details) {
    const eventType = {
      CONSENT_GIVEN: "CONSENT_GIVEN" /* CONSENT_GIVEN */,
      CONSENT_WITHDRAWN: "CONSENT_WITHDRAWN" /* CONSENT_WITHDRAWN */,
      DATA_REQUEST: "DATA_REQUEST" /* DATA_REQUEST */,
      DATA_DELETION: "DATA_DELETION" /* DATA_DELETION */
    }[type];
    this.log(eventType, "INFO" /* INFO */, "SUCCESS", { userId, details });
  }
  async generateAuditReport(startDate, endDate, filters) {
    if (!this.enableDatabase) {
      throw new Error("Database audit logging must be enabled for report generation");
    }
    try {
      let whereConditions = sql2`${auditLog.timestamp} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}`;
      if (filters?.userId) {
        whereConditions = sql2`${whereConditions} AND ${auditLog.userId} = ${filters.userId}`;
      }
      if (filters?.resource) {
        whereConditions = sql2`${whereConditions} AND ${auditLog.resource} = ${filters.resource}`;
      }
      if (filters?.eventType) {
        whereConditions = sql2`${whereConditions} AND ${auditLog.action} LIKE ${`%${filters.eventType}%`}`;
      }
      const entries = await db.select().from(auditLog).where(whereConditions).orderBy(sql2`${auditLog.timestamp} DESC`);
      const summary = {
        total: entries.length,
        byEventType: {},
        bySeverity: {},
        byResult: {},
        byUser: {}
      };
      entries.forEach((entry) => {
        const metadata = entry.metadata;
        if (metadata) {
          const eventType = metadata.eventType || "unknown";
          summary.byEventType[eventType] = (summary.byEventType[eventType] || 0) + 1;
          const severity = metadata.severity || "unknown";
          summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;
          const result = metadata.result || "unknown";
          summary.byResult[result] = (summary.byResult[result] || 0) + 1;
        }
        if (entry.userId) {
          summary.byUser[entry.userId] = (summary.byUser[entry.userId] || 0) + 1;
        }
      });
      return { entries, summary };
    } catch (error) {
      console.error("Failed to generate audit report:", error);
      throw error;
    }
  }
  async shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flushBuffer();
  }
  // Enhanced logging methods for comprehensive audit trail
  logApiRequest(req, res, duration) {
    const eventType = req.method === "GET" ? "DATA_READ" /* DATA_READ */ : req.method === "POST" ? "DATA_CREATE" /* DATA_CREATE */ : req.method === "PUT" || req.method === "PATCH" ? "DATA_UPDATE" /* DATA_UPDATE */ : req.method === "DELETE" ? "DATA_DELETE" /* DATA_DELETE */ : "DATA_READ" /* DATA_READ */;
    this.log(
      eventType,
      res.statusCode >= 400 ? "WARNING" /* WARNING */ : "INFO" /* INFO */,
      res.statusCode < 400 ? "SUCCESS" : "FAILURE",
      {
        userId: req.user?.id || "anonymous",
        sessionId: req.sessionID || req.headers["x-session-id"],
        ipAddress: this.getClientIP(req),
        userAgent: req.headers["user-agent"],
        resource: req.route?.path || req.path,
        action: req.method,
        details: {
          url: req.url,
          method: req.method,
          statusCode: res.statusCode,
          duration,
          bodySize: JSON.stringify(req.body || {}).length,
          query: req.query,
          params: req.params
        }
      }
    );
  }
  logDataModification(userId, action, resource, resourceId, beforeState, afterState, metadata) {
    const eventType = {
      CREATE: "DATA_CREATE" /* DATA_CREATE */,
      UPDATE: "DATA_UPDATE" /* DATA_UPDATE */,
      DELETE: "DATA_DELETE" /* DATA_DELETE */
    }[action];
    this.log(eventType, "INFO" /* INFO */, "SUCCESS", {
      userId,
      resource,
      action,
      beforeState,
      afterState,
      details: {
        resourceId,
        ...metadata
      }
    });
  }
  logExport(userId, exportType, resourceIds, format, includesPII) {
    this.log(
      "DATA_EXPORT" /* DATA_EXPORT */,
      includesPII ? "WARNING" /* WARNING */ : "INFO" /* INFO */,
      "SUCCESS",
      {
        userId,
        resource: "export",
        action: "EXPORT",
        details: {
          exportType,
          resourceIds,
          format,
          includesPII,
          resourceCount: resourceIds.length
        }
      }
    );
  }
  getClientIP(req) {
    return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  }
};
var auditLogger = new AuditLogger({
  enableDatabase: process.env.AUDIT_ENABLE_DATABASE !== "false",
  enableFiles: process.env.AUDIT_ENABLE_FILES !== "false"
});
process.on("SIGINT", async () => {
  await auditLogger.shutdown();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await auditLogger.shutdown();
  process.exit(0);
});
process.on("SIGQUIT", async () => {
  await auditLogger.shutdown();
  process.exit(0);
});

// server/middleware/audit.ts
function auditMiddleware(req, res, next) {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  req.auditContext = {
    correlationId,
    startTime,
    skipAudit: false
  };
  if (shouldSkipAudit(req)) {
    req.auditContext.skipAudit = true;
    return next();
  }
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody;
  res.send = function(body) {
    responseBody = body;
    return originalSend.call(this, body);
  };
  res.json = function(body) {
    responseBody = body;
    return originalJson.call(this, body);
  };
  res.on("finish", () => {
    if (req.auditContext?.skipAudit) return;
    const duration = Date.now() - startTime;
    try {
      auditLogger.logApiRequest(req, res, duration);
      if (isSensitiveOperation(req)) {
        logSensitiveOperation(req, res, responseBody, correlationId);
      }
    } catch (error) {
      console.error("Audit middleware error:", error);
    }
  });
  next();
}
function logDataModification(req, action, resource, resourceId, afterState) {
  if (req.auditContext?.skipAudit) return;
  const userId = req.user?.id || "anonymous";
  const beforeState = req.auditContext?.beforeState;
  auditLogger.logDataModification(
    userId,
    action,
    resource,
    resourceId,
    beforeState,
    afterState,
    {
      correlationId: req.auditContext?.correlationId,
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"]
    }
  );
}
function logExportOperation(req, exportType, resourceIds, format, containsPII = true) {
  if (req.auditContext?.skipAudit) return;
  const userId = req.user?.id || "anonymous";
  auditLogger.logExport(userId, exportType, resourceIds, format, containsPII);
  if (containsPII) {
    auditLogger.log(
      "DATA_EXPORT" /* DATA_EXPORT */,
      "WARNING" /* WARNING */,
      "SUCCESS",
      {
        userId,
        resource: "pii-export",
        action: "EXPORT_PII",
        details: {
          exportType,
          resourceCount: resourceIds.length,
          format,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          requiresRetention: true
        }
      }
    );
  }
}
function logError(req, error, context) {
  if (req.auditContext?.skipAudit) return;
  auditLogger.logError(error, req.user?.id, {
    correlationId: req.auditContext?.correlationId,
    url: req.url,
    method: req.method,
    ipAddress: getClientIP(req),
    userAgent: req.headers["user-agent"],
    ...context
  });
}
function generateCorrelationId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function shouldSkipAudit(req) {
  const skipPaths = [
    "/api/health",
    "/favicon.ico",
    "/ping",
    "/metrics"
  ];
  const skipPatterns = [
    /^\/static\//,
    /^\/assets\//,
    /^\/public\//,
    /\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/
  ];
  if (skipPaths.includes(req.path)) {
    return true;
  }
  if (skipPatterns.some((pattern) => pattern.test(req.path))) {
    return true;
  }
  if (req.method === "OPTIONS") {
    return true;
  }
  return false;
}
function isSensitiveOperation(req) {
  const sensitivePaths = [
    "/api/auth",
    "/api/users",
    "/api/export",
    "/api/cases",
    "/api/documents"
  ];
  return sensitivePaths.some((path8) => req.path.startsWith(path8)) || isModificationOperation(req);
}
function isModificationOperation(req) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
}
function logSensitiveOperation(req, res, responseBody, correlationId) {
  const severity = res.statusCode >= 400 ? "ERROR" /* ERROR */ : "INFO" /* INFO */;
  const result = res.statusCode < 400 ? "SUCCESS" : "FAILURE";
  let eventType = "DATA_READ" /* DATA_READ */;
  if (req.path.startsWith("/api/auth")) {
    eventType = "LOGIN_SUCCESS" /* LOGIN_SUCCESS */;
  } else if (req.path.includes("/export")) {
    eventType = "DATA_EXPORT" /* DATA_EXPORT */;
  } else if (isModificationOperation(req)) {
    eventType = req.method === "POST" ? "DATA_CREATE" /* DATA_CREATE */ : req.method === "DELETE" ? "DATA_DELETE" /* DATA_DELETE */ : "DATA_UPDATE" /* DATA_UPDATE */;
  }
  auditLogger.log(
    eventType,
    severity,
    result,
    {
      userId: req.user?.id || "anonymous",
      sessionId: req.sessionID || req.headers["x-session-id"],
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"],
      resource: extractResourceFromPath(req.path),
      action: req.method,
      correlationId,
      details: {
        url: req.url,
        statusCode: res.statusCode,
        responseSize: JSON.stringify(responseBody || {}).length,
        sensitive: true
      }
    }
  );
}
function extractResourceFromPath(path8) {
  const segments = path8.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[0] === "api") {
    return segments[1];
  }
  return "unknown";
}
function getClientIP(req) {
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

// server/services/auth.ts
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";
var JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
var BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10");
var AuthService = class {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
  /**
   * Generate a JWT token
   */
  static generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }
  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }
  /**
   * Register a new user
   */
  static async register(userData) {
    const existingUser = await db.select().from(users).where(eq(users.username, userData.username)).limit(1);
    if (existingUser.length > 0) {
      throw new Error("Username already exists");
    }
    const hashedPassword = await this.hashPassword(userData.password);
    const [newUser] = await db.insert(users).values({
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...userData,
      password: hashedPassword
    }).returning();
    const token = this.generateToken({
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role
    });
    const { password: _, ...userWithoutPassword } = newUser;
    return {
      user: userWithoutPassword,
      token
    };
  }
  /**
   * Login a user
   */
  static async login(username, password) {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) {
      throw new Error("Invalid credentials");
    }
    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }
    const token = this.generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });
    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token
    };
  }
  /**
   * Get user by ID
   */
  static async getUserById(userId) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return null;
    }
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  /**
   * Update user password
   */
  static async updatePassword(userId, newPassword) {
    const hashedPassword = await this.hashPassword(newPassword);
    await db.update(users).set({
      password: hashedPassword,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, userId));
  }
  /**
   * Validate user role for authorization
   */
  static hasRole(user, allowedRoles) {
    return allowedRoles.includes(user.role);
  }
};

// server/middleware/auth.ts
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Invalid authorization format" });
    }
    const token = parts[1];
    try {
      const payload = AuthService.verifyToken(token);
      AuthService.getUserById(payload.userId).then((user) => {
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }
        req.user = user;
        req.token = token;
        next();
      }).catch((error) => {
        console.error("Auth middleware error:", error);
        return res.status(500).json({ error: "Authentication failed" });
      });
      return;
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!AuthService.hasRole(req.user, allowedRoles)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
var requireAuth = authenticate;

// server/services/mfa.ts
import { and, count, eq as eq2, gte } from "drizzle-orm";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import speakeasy from "speakeasy";
import twilio from "twilio";

// server/services/crypto.ts
import crypto3 from "crypto";
var ALGORITHM = "aes-256-gcm";
var IV_LENGTH = 16;
var ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error("MFA_ENCRYPTION_KEY must be set in environment variables");
}
var keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
if (keyBuffer.length !== 32) {
  throw new Error("MFA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
}
function encrypt(text2) {
  const iv = crypto3.randomBytes(IV_LENGTH);
  const cipher = crypto3.createCipher(ALGORITHM, keyBuffer);
  cipher.setAAD(Buffer.from("mfa-data"));
  let encrypted = cipher.update(text2, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted
  };
}
function decrypt(encryptedData) {
  const iv = Buffer.from(encryptedData.iv, "hex");
  const tag = Buffer.from(encryptedData.tag, "hex");
  const decipher = crypto3.createDecipher(ALGORITHM, keyBuffer);
  decipher.setAAD(Buffer.from("mfa-data"));
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedData.data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
function hashData(data) {
  return crypto3.createHash("sha256").update(data).digest("hex");
}
function generateSecureCode(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const bytes = crypto3.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
function generateDeviceFingerprint(userAgent, ipAddress) {
  const data = `${userAgent}:${ipAddress}`;
  return crypto3.createHash("sha256").update(data).digest("hex");
}

// server/services/mfa.ts
var EMAIL_CONFIG = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};
var TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER
};
var MFA_CONFIG = {
  appName: "Solicitor Brain",
  gracePeriodDays: parseInt(process.env.MFA_GRACE_PERIOD_DAYS || "7"),
  maxAttemptsPerHour: parseInt(process.env.MFA_MAX_ATTEMPTS_PER_HOUR || "5"),
  trustedDeviceDays: parseInt(process.env.MFA_TRUSTED_DEVICE_DAYS || "30"),
  backupCodesCount: parseInt(process.env.MFA_BACKUP_CODES_COUNT || "10")
};
var emailTransporter = null;
var twilioClient = null;
if (EMAIL_CONFIG.host && EMAIL_CONFIG.auth.user) {
  emailTransporter = nodemailer.createTransport(EMAIL_CONFIG);
}
if (TWILIO_CONFIG.accountSid && TWILIO_CONFIG.authToken) {
  twilioClient = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);
}
var MfaService = class {
  /**
   * Check if MFA is enabled for a user
   */
  async isMfaEnabled(userId) {
    const settings = await db.select().from(mfaSettings).where(eq2(mfaSettings.userId, userId)).limit(1);
    return settings.length > 0 && settings[0].isEnabled;
  }
  /**
   * Check if user is in MFA grace period
   */
  async isInGracePeriod(userId) {
    const settings = await db.select().from(mfaSettings).where(eq2(mfaSettings.userId, userId)).limit(1);
    if (settings.length === 0) return false;
    const gracePeriodEnd = settings[0].gracePeriodEnd;
    if (!gracePeriodEnd) return false;
    return /* @__PURE__ */ new Date() < gracePeriodEnd;
  }
  /**
   * Setup TOTP for a user
   */
  async setupTotp(userId, userEmail) {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: MFA_CONFIG.appName,
      length: 32
    });
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    const backupCodes = Array.from(
      { length: MFA_CONFIG.backupCodesCount },
      () => generateSecureCode(8)
    );
    const encryptedSecret = encrypt(secret.base32);
    const encryptedBackupCodes = backupCodes.map((code) => encrypt(code));
    const encryptedEmail = encrypt(userEmail);
    const gracePeriodEnd = /* @__PURE__ */ new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + MFA_CONFIG.gracePeriodDays);
    await db.insert(mfaSettings).values({
      userId,
      isEnabled: false,
      // Will be enabled after verification
      totpSecret: JSON.stringify(encryptedSecret),
      backupCodes: JSON.stringify(encryptedBackupCodes),
      emailAddress: JSON.stringify(encryptedEmail),
      gracePeriodEnd
    }).onConflictDoUpdate({
      target: mfaSettings.userId,
      set: {
        totpSecret: JSON.stringify(encryptedSecret),
        backupCodes: JSON.stringify(encryptedBackupCodes),
        emailAddress: JSON.stringify(encryptedEmail),
        gracePeriodEnd,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
    const recoveryCodeInserts = backupCodes.map((code) => ({
      userId,
      codeHash: hashData(code),
      used: false
    }));
    await db.delete(mfaRecoveryCodes).where(eq2(mfaRecoveryCodes.userId, userId));
    await db.insert(mfaRecoveryCodes).values(recoveryCodeInserts);
    await this.logMfaEvent(userId, "mfa_setup_initiated", true, "", "");
    return {
      secret: secret.base32,
      qrCode,
      backupCodes
    };
  }
  /**
   * Verify TOTP setup and enable MFA
   */
  async verifyTotpSetup(userId, token, context) {
    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.totpSecret) {
      await this.logMfaEvent(userId, "totp", false, context.ipAddress, context.userAgent);
      return false;
    }
    const encryptedSecret = JSON.parse(settings.totpSecret);
    const secret = decrypt(encryptedSecret);
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2
      // Allow 2 time steps before/after current
    });
    if (verified) {
      await db.update(mfaSettings).set({
        isEnabled: true,
        updatedAt: /* @__PURE__ */ new Date(),
        gracePeriodEnd: null
        // Remove grace period
      }).where(eq2(mfaSettings.userId, userId));
      await this.logMfaEvent(
        userId,
        "totp_setup_completed",
        true,
        context.ipAddress,
        context.userAgent
      );
    } else {
      await this.logMfaEvent(
        userId,
        "totp_setup_failed",
        false,
        context.ipAddress,
        context.userAgent
      );
    }
    return verified;
  }
  /**
   * Verify TOTP token
   */
  async verifyTotp(userId, token, context) {
    if (await this.isRateLimited(userId)) {
      await this.logMfaEvent(userId, "totp", false, context.ipAddress, context.userAgent);
      return false;
    }
    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.totpSecret || !settings.isEnabled) {
      await this.logMfaEvent(userId, "totp", false, context.ipAddress, context.userAgent);
      return false;
    }
    const encryptedSecret = JSON.parse(settings.totpSecret);
    const secret = decrypt(encryptedSecret);
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 1
      // Stricter window for actual verification
    });
    await this.logMfaEvent(userId, "totp", verified, context.ipAddress, context.userAgent);
    return verified;
  }
  /**
   * Send SMS verification code
   */
  async sendSmsCode(userId, phoneNumber) {
    if (!twilioClient) {
      throw new Error("SMS service not configured");
    }
    if (await this.isRateLimited(userId)) {
      return false;
    }
    const ukPhoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;
    if (!ukPhoneRegex.test(phoneNumber)) {
      throw new Error("Invalid UK phone number format");
    }
    const code = Math.floor(1e5 + Math.random() * 9e5).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
    const encryptedPhone = encrypt(phoneNumber);
    const encryptedCode = encrypt(code);
    await db.update(mfaSettings).set({
      smsPhoneNumber: JSON.stringify({
        ...encryptedPhone,
        code: encryptedCode,
        expiresAt: expiresAt.toISOString()
      }),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(mfaSettings.userId, userId));
    try {
      await twilioClient.messages.create({
        body: `Your Solicitor Brain verification code is: ${code}. This code expires in 10 minutes.`,
        from: TWILIO_CONFIG.phoneNumber,
        to: phoneNumber
      });
      await this.logMfaEvent(userId, "sms_sent", true, "", "");
      return true;
    } catch (error) {
      await this.logMfaEvent(userId, "sms_send_failed", false, "", "");
      throw error;
    }
  }
  /**
   * Verify SMS code
   */
  async verifySmsCode(userId, code, context) {
    if (await this.isRateLimited(userId)) {
      await this.logMfaEvent(userId, "sms", false, context.ipAddress, context.userAgent);
      return false;
    }
    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.smsPhoneNumber) {
      await this.logMfaEvent(userId, "sms", false, context.ipAddress, context.userAgent);
      return false;
    }
    const smsData = JSON.parse(settings.smsPhoneNumber);
    if (/* @__PURE__ */ new Date() > new Date(smsData.expiresAt)) {
      await this.logMfaEvent(userId, "sms", false, context.ipAddress, context.userAgent);
      return false;
    }
    const storedCode = decrypt(smsData.code);
    const verified = code === storedCode;
    if (verified) {
      await db.update(mfaSettings).set({
        smsPhoneNumber: JSON.stringify({
          iv: smsData.iv,
          tag: smsData.tag,
          data: smsData.data
        }),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(mfaSettings.userId, userId));
    }
    await this.logMfaEvent(userId, "sms", verified, context.ipAddress, context.userAgent);
    return verified;
  }
  /**
   * Send email verification code
   */
  async sendEmailCode(userId) {
    if (!emailTransporter) {
      throw new Error("Email service not configured");
    }
    if (await this.isRateLimited(userId)) {
      return false;
    }
    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.emailAddress) {
      return false;
    }
    const encryptedEmail = JSON.parse(settings.emailAddress);
    const email = decrypt(encryptedEmail);
    const code = Math.floor(1e5 + Math.random() * 9e5).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
    const encryptedCode = encrypt(code);
    await db.update(mfaSettings).set({
      emailAddress: JSON.stringify({
        ...encryptedEmail,
        code: encryptedCode,
        expiresAt: expiresAt.toISOString()
      }),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(mfaSettings.userId, userId));
    try {
      await emailTransporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: "Solicitor Brain - Verification Code",
        html: `
          <h2>Verification Code</h2>
          <p>Your verification code is: <strong>${code}</strong></p>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this code, please contact support immediately.</p>
        `
      });
      await this.logMfaEvent(userId, "email_sent", true, "", "");
      return true;
    } catch (error) {
      await this.logMfaEvent(userId, "email_send_failed", false, "", "");
      throw error;
    }
  }
  /**
   * Verify email code
   */
  async verifyEmailCode(userId, code, context) {
    if (await this.isRateLimited(userId)) {
      await this.logMfaEvent(userId, "email", false, context.ipAddress, context.userAgent);
      return false;
    }
    const settings = await this.getUserMfaSettings(userId);
    if (!settings || !settings.emailAddress) {
      await this.logMfaEvent(userId, "email", false, context.ipAddress, context.userAgent);
      return false;
    }
    const emailData = JSON.parse(settings.emailAddress);
    if (!emailData.code || !emailData.expiresAt) {
      await this.logMfaEvent(userId, "email", false, context.ipAddress, context.userAgent);
      return false;
    }
    if (/* @__PURE__ */ new Date() > new Date(emailData.expiresAt)) {
      await this.logMfaEvent(userId, "email", false, context.ipAddress, context.userAgent);
      return false;
    }
    const storedCode = decrypt(emailData.code);
    const verified = code === storedCode;
    if (verified) {
      const { code: _, expiresAt: __, ...cleanEmailData } = emailData;
      await db.update(mfaSettings).set({
        emailAddress: JSON.stringify(cleanEmailData),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(mfaSettings.userId, userId));
    }
    await this.logMfaEvent(userId, "email", verified, context.ipAddress, context.userAgent);
    return verified;
  }
  /**
   * Verify backup code
   */
  async verifyBackupCode(userId, code, context) {
    if (await this.isRateLimited(userId)) {
      await this.logMfaEvent(userId, "backup", false, context.ipAddress, context.userAgent);
      return false;
    }
    const codeHash = hashData(code);
    const recoveryCode = await db.select().from(mfaRecoveryCodes).where(
      and(
        eq2(mfaRecoveryCodes.userId, userId),
        eq2(mfaRecoveryCodes.codeHash, codeHash),
        eq2(mfaRecoveryCodes.used, false)
      )
    ).limit(1);
    if (recoveryCode.length === 0) {
      await this.logMfaEvent(userId, "backup", false, context.ipAddress, context.userAgent);
      return false;
    }
    await db.update(mfaRecoveryCodes).set({ used: true, usedAt: /* @__PURE__ */ new Date() }).where(eq2(mfaRecoveryCodes.id, recoveryCode[0].id));
    await this.logMfaEvent(userId, "backup", true, context.ipAddress, context.userAgent);
    return true;
  }
  /**
   * Add trusted device
   */
  async addTrustedDevice(userId, context, options = {}) {
    const deviceFingerprint = generateDeviceFingerprint(context.userAgent, context.ipAddress);
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setDate(
      expiresAt.getDate() + (options.expirationDays || MFA_CONFIG.trustedDeviceDays)
    );
    const deviceData = {
      userId,
      deviceFingerprint,
      deviceName: options.deviceName || "Unknown Device",
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt
    };
    await db.insert(trustedDevices).values(deviceData);
    await this.logMfaEvent(
      userId,
      "trusted_device_added",
      true,
      context.ipAddress,
      context.userAgent
    );
    return deviceFingerprint;
  }
  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId, context) {
    const deviceFingerprint = generateDeviceFingerprint(context.userAgent, context.ipAddress);
    const trustedDevice = await db.select().from(trustedDevices).where(
      and(
        eq2(trustedDevices.userId, userId),
        eq2(trustedDevices.deviceFingerprint, deviceFingerprint),
        gte(trustedDevices.expiresAt, /* @__PURE__ */ new Date())
      )
    ).limit(1);
    if (trustedDevice.length > 0) {
      await db.update(trustedDevices).set({ lastUsed: /* @__PURE__ */ new Date() }).where(eq2(trustedDevices.id, trustedDevice[0].id));
      return true;
    }
    return false;
  }
  /**
   * Remove trusted device
   */
  async removeTrustedDevice(userId, deviceId) {
    const result = await db.delete(trustedDevices).where(and(eq2(trustedDevices.userId, userId), eq2(trustedDevices.id, deviceId)));
    await this.logMfaEvent(userId, "trusted_device_removed", true, "", "");
    return result.rowCount > 0;
  }
  /**
   * Get user's trusted devices
   */
  async getTrustedDevices(userId) {
    return await db.select({
      id: trustedDevices.id,
      deviceName: trustedDevices.deviceName,
      lastUsed: trustedDevices.lastUsed,
      createdAt: trustedDevices.createdAt,
      expiresAt: trustedDevices.expiresAt
    }).from(trustedDevices).where(and(eq2(trustedDevices.userId, userId), gte(trustedDevices.expiresAt, /* @__PURE__ */ new Date()))).orderBy(trustedDevices.lastUsed);
  }
  /**
   * Disable MFA for a user (emergency use)
   */
  async disableMfa(userId, adminUserId) {
    await db.update(mfaSettings).set({ isEnabled: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(mfaSettings.userId, userId));
    await db.delete(trustedDevices).where(eq2(trustedDevices.userId, userId));
    await db.insert(auditLog).values({
      userId: adminUserId,
      action: "mfa_disabled_by_admin",
      resource: "user",
      resourceId: userId,
      metadata: { targetUserId: userId }
    });
  }
  /**
   * Generate new backup codes
   */
  async generateNewBackupCodes(userId) {
    const backupCodes = Array.from(
      { length: MFA_CONFIG.backupCodesCount },
      () => generateSecureCode(8)
    );
    const encryptedBackupCodes = backupCodes.map((code) => encrypt(code));
    await db.update(mfaSettings).set({
      backupCodes: JSON.stringify(encryptedBackupCodes),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(mfaSettings.userId, userId));
    await db.delete(mfaRecoveryCodes).where(eq2(mfaRecoveryCodes.userId, userId));
    const recoveryCodeInserts = backupCodes.map((code) => ({
      userId,
      codeHash: hashData(code),
      used: false
    }));
    await db.insert(mfaRecoveryCodes).values(recoveryCodeInserts);
    await this.logMfaEvent(userId, "backup_codes_regenerated", true, "", "");
    return backupCodes;
  }
  /**
   * Get MFA status for user
   */
  async getMfaStatus(userId) {
    const settings = await this.getUserMfaSettings(userId);
    const trustedDevicesCount = await db.select({ count: count() }).from(trustedDevices).where(and(eq2(trustedDevices.userId, userId), gte(trustedDevices.expiresAt, /* @__PURE__ */ new Date())));
    const unusedBackupCodes = await db.select({ count: count() }).from(mfaRecoveryCodes).where(and(eq2(mfaRecoveryCodes.userId, userId), eq2(mfaRecoveryCodes.used, false)));
    return {
      enabled: settings?.isEnabled || false,
      hasTotp: !!settings?.totpSecret,
      hasSms: !!settings?.smsPhoneNumber,
      hasEmail: !!settings?.emailAddress,
      inGracePeriod: await this.isInGracePeriod(userId),
      gracePeriodEnd: settings?.gracePeriodEnd,
      trustedDevicesCount: trustedDevicesCount[0].count,
      unusedBackupCodes: unusedBackupCodes[0].count
    };
  }
  /**
   * Private helper methods
   */
  async getUserMfaSettings(userId) {
    const settings = await db.select().from(mfaSettings).where(eq2(mfaSettings.userId, userId)).limit(1);
    return settings.length > 0 ? settings[0] : null;
  }
  async isRateLimited(userId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
    const attempts = await db.select({ count: count() }).from(mfaAttempts).where(and(eq2(mfaAttempts.userId, userId), gte(mfaAttempts.attemptedAt, oneHourAgo)));
    return attempts[0].count >= MFA_CONFIG.maxAttemptsPerHour;
  }
  async logMfaEvent(userId, method, success, ipAddress, userAgent) {
    const attemptData = {
      userId,
      method,
      success,
      ipAddress,
      userAgent
    };
    await db.insert(mfaAttempts).values(attemptData);
    const auditData = {
      userId,
      action: `mfa_${method}_${success ? "success" : "failure"}`,
      resource: "authentication",
      resourceId: userId,
      metadata: {
        method,
        success,
        ipAddress,
        userAgent: userAgent.substring(0, 255)
        // Truncate if too long
      }
    };
    await db.insert(auditLog).values(auditData);
  }
};
var mfaService = new MfaService();

// server/middleware/mfa.ts
function checkMfaRequirement(req, res, next) {
  if (req.path.startsWith("/api/mfa/")) {
    return next();
  }
  if (!req.user) {
    return next();
  }
  const context = {
    userId: req.user.id,
    ipAddress: req.ip || req.connection.remoteAddress || "unknown",
    userAgent: req.get("User-Agent") || "unknown"
  };
  Promise.all([
    mfaService.isMfaEnabled(req.user.id),
    mfaService.isInGracePeriod(req.user.id),
    mfaService.isDeviceTrusted(req.user.id, context)
  ]).then(([mfaEnabled, inGracePeriod, deviceTrusted]) => {
    req.mfaRequired = mfaEnabled && !inGracePeriod && !deviceTrusted;
    req.deviceTrusted = deviceTrusted;
    req.mfaVerified = false;
    if (req.mfaRequired && !req.mfaVerified) {
      return res.status(403).json({
        error: "MFA verification required",
        mfaRequired: true,
        inGracePeriod,
        deviceTrusted
      });
    }
    next();
  }).catch((error) => {
    console.error("MFA check error:", error);
    res.status(500).json({ error: "Failed to check MFA requirements" });
  });
}

// server/routes/agents.ts
import { Router } from "express";
var router = Router();
var agents = {
  chief: {
    name: "Chief Legal Officer",
    model: "dolphin-mixtral",
    role: "Primary case analysis and strategy",
    status: "active"
  },
  research: {
    name: "Research Specialist",
    model: "dolphin-mistral",
    role: "Legal research and precedents",
    status: "active"
  },
  document: {
    name: "Document Analyst",
    model: "llama3.2",
    role: "Document review and analysis",
    status: "active"
  },
  compliance: {
    name: "Compliance Officer",
    model: "mistral:7b-instruct",
    role: "GDPR and regulatory compliance",
    status: "active"
  },
  generator: {
    name: "Document Generator",
    model: "solar",
    role: "Legal document drafting",
    status: "active"
  },
  liaison: {
    name: "Client Liaison",
    model: "qwen2.5",
    role: "Client communication and updates",
    status: "active"
  }
};
async function callOllama(model, prompt, system) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        system,
        stream: false
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Ollama error:", error);
    throw error;
  }
}
router.get("/agents/status", authenticate, async (req, res) => {
  try {
    const agentList = Object.entries(agents).map(([id, agent]) => ({
      id,
      ...agent
    }));
    res.json({ agents: agentList });
  } catch (_) {
    res.status(500).json({ error: "Failed to get agent status" });
  }
});
router.post("/agents/analyze-case", authenticate, async (req, res) => {
  try {
    const { caseData } = req.body;
    const prompt = `Analyze this legal case and provide strategic recommendations:
${JSON.stringify(caseData, null, 2)}

Provide:
1. Key legal issues identified
2. Recommended strategy
3. Risk assessment
4. Next steps`;
    const result = await callOllama(
      agents.chief.model,
      prompt,
      "You are a senior legal strategist specializing in UK law."
    );
    res.json({
      chiefAnalysis: {
        result,
        agent: agents.chief.name,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (_) {
    res.status(500).json({ error: "Failed to analyze case" });
  }
});
router.post("/agents/research", authenticate, async (req, res) => {
  try {
    const { query } = req.body;
    const prompt = `Research the following legal query:
${query}

Provide:
1. Relevant UK case law
2. Applicable statutes
3. Legal precedents
4. Summary of findings`;
    const result = await callOllama(
      agents.research.model,
      prompt,
      "You are a legal research specialist in UK law."
    );
    res.json({
      research: {
        result,
        agent: agents.research.name,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (_) {
    res.status(500).json({ error: "Failed to perform research" });
  }
});
router.post("/agents/analyze-document", authenticate, async (req, res) => {
  try {
    const { documentContent, documentType } = req.body;
    const prompt = `Analyze this ${documentType || "legal document"}:
${documentContent}

Provide:
1. Document summary
2. Key points and terms
3. Potential issues or concerns
4. Recommendations`;
    const result = await callOllama(
      agents.document.model,
      prompt,
      "You are a legal document analyst specializing in UK legal documents."
    );
    res.json({
      analysis: {
        result,
        agent: agents.document.name,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (_) {
    res.status(500).json({ error: "Failed to analyze document" });
  }
});
router.post("/agents/compliance", authenticate, async (req, res) => {
  try {
    const { checkType, data } = req.body;
    const prompt = `Perform a ${checkType || "GDPR"} compliance check:
${JSON.stringify(data, null, 2)}

Check for:
1. Data protection compliance
2. Required consents
3. Retention policies
4. Recommendations for compliance`;
    const result = await callOllama(
      agents.compliance.model,
      prompt,
      "You are a compliance officer specializing in UK GDPR and data protection law."
    );
    res.json({
      compliance: {
        result,
        compliant: true,
        // Would need parsing of result
        agent: agents.compliance.name,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (_) {
    res.status(500).json({ error: "Failed to check compliance" });
  }
});
router.post("/agents/generate-document", authenticate, async (req, res) => {
  try {
    const { documentType, data } = req.body;
    const prompt = `Generate a ${documentType || "legal letter"} with the following information:
${JSON.stringify(data, null, 2)}

The document should be:
1. Professionally formatted
2. Legally accurate for UK
3. Clear and concise
4. Ready for review`;
    const result = await callOllama(
      agents.generator.model,
      prompt,
      "You are a legal document generator specializing in UK legal correspondence."
    );
    res.json({
      document: {
        result,
        type: documentType,
        agent: agents.generator.name,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (_) {
    res.status(500).json({ error: "Failed to generate document" });
  }
});
router.post("/agents/client-update", authenticate, async (req, res) => {
  try {
    const { caseUpdate, clientInfo } = req.body;
    const prompt = `Draft a client update based on:
Case Update: ${JSON.stringify(caseUpdate, null, 2)}
Client Info: ${JSON.stringify(clientInfo, null, 2)}

Create:
1. Clear summary of progress
2. Next steps explanation
3. Any required actions from client
4. Supportive and professional tone`;
    const result = await callOllama(
      agents.liaison.model,
      prompt,
      "You are a client liaison officer providing trauma-informed legal communication."
    );
    res.json({
      clientUpdate: {
        result,
        agent: agents.liaison.name,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (_) {
    res.status(500).json({ error: "Failed to generate client update" });
  }
});
router.post("/agents/chat", authenticate, async (req, res) => {
  try {
    const { message, agentId = "chief" } = req.body;
    const agent = agents[agentId] || agents.chief;
    const result = await callOllama(agent.model, message, `You are ${agent.name}, ${agent.role}`);
    res.json({
      response: result,
      agent: agent.name,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (_) {
    res.status(500).json({ error: "Failed to process chat message" });
  }
});
var agents_default = router;

// server/routes/ai.ts
import { Router as Router2 } from "express";

// server/services/real-ai.ts
import { Ollama } from "ollama";
var RealAIService = class {
  constructor() {
    this.embedModel = "nomic-embed-text:latest";
    this.chatModel = "llama3.2:latest";
    this.ollama = new Ollama({
      host: process.env.OLLAMA_HOST || "http://localhost:11434"
    });
  }
  async chat(message, context) {
    try {
      const systemPrompt = this.getSystemPrompt(context?.mode);
      const contextualMessage = this.buildContextualMessage(message, context);
      const response = await this.ollama.chat({
        model: context?.model === "mistral" ? "mistral:7b" : this.chatModel,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: contextualMessage
          }
        ],
        stream: false
      });
      return response.message.content;
    } catch (error) {
      console.error("Ollama chat error:", error);
      throw new Error("AI service temporarily unavailable");
    }
  }
  async chatStream(message, context) {
    try {
      const systemPrompt = this.getSystemPrompt(context?.mode);
      const contextualMessage = this.buildContextualMessage(message, context);
      let fullResponse = "";
      const response = await this.ollama.chat({
        model: context?.model === "mistral" ? "mistral:7b" : this.chatModel,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: contextualMessage
          }
        ],
        stream: true
      });
      for await (const part of response) {
        const chunk = part.message.content;
        fullResponse += chunk;
        if (context?.onChunk) {
          context.onChunk(chunk);
        }
      }
      return fullResponse;
    } catch (error) {
      console.error("Ollama streaming chat error:", error);
      throw new Error("AI streaming service temporarily unavailable");
    }
  }
  getSystemPrompt(mode) {
    const basePrompt = "You are a helpful legal assistant specializing in UK law. Provide accurate, professional advice while being empathetic to clients.";
    switch (mode) {
      case "legal":
        return `${basePrompt} Focus on providing detailed legal analysis, identifying relevant statutes, case law, and procedural requirements. Always include confidence levels and suggest when professional legal advice should be sought.`;
      case "draft":
        return `${basePrompt} Focus on drafting professional legal documents, letters, and correspondence. Use appropriate legal language while maintaining clarity. Include standard legal disclaimers and ensure trauma-informed language.`;
      default:
        return basePrompt;
    }
  }
  buildContextualMessage(message, context) {
    let contextualMessage = message;
    if (context?.caseId) {
      contextualMessage = `[Case ID: ${context.caseId}] ${contextualMessage}`;
    }
    if (context?.documentId) {
      contextualMessage = `[Document Context Available] ${contextualMessage}`;
    }
    if (context?.attachedFiles && context.attachedFiles.length > 0) {
      const fileList = context.attachedFiles.map((f) => f.name).join(", ");
      contextualMessage = `[Attached Files: ${fileList}] ${contextualMessage}`;
    }
    if (context?.previousMessages && context.previousMessages.length > 0) {
      const recentContext = context.previousMessages.slice(-3).map((msg) => `${msg.role}: ${msg.content.slice(0, 200)}`).join("\n");
      contextualMessage = `[Recent conversation context:
${recentContext}]

${contextualMessage}`;
    }
    return contextualMessage;
  }
  async generateEmbedding(text2) {
    try {
      const response = await this.ollama.embeddings({
        model: this.embedModel,
        prompt: text2
      });
      return response.embedding;
    } catch (error) {
      console.error("Ollama embedding error:", error);
      throw new Error("Embedding generation failed");
    }
  }
  async analyzeDocument(content) {
    try {
      const prompt = `Analyze this legal document and extract:
1. Key parties involved
2. Important dates
3. Main legal issues
4. Risk assessment (high/medium/low)
5. Recommended actions

Document:
${content.substring(0, 3e3)}`;
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        stream: false
      });
      return {
        analysis: response.message.content,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Document analysis error:", error);
      throw new Error("Document analysis failed");
    }
  }
  async generateDraft(template, data) {
    try {
      const prompt = `Generate a professional legal document based on this template and data:

Template: ${template}
Data: ${JSON.stringify(data)}

Create a complete, properly formatted document.`;
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        stream: false
      });
      return response.message.content;
    } catch (error) {
      console.error("Draft generation error:", error);
      throw new Error("Draft generation failed");
    }
  }
  async summarize(text2) {
    try {
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: "user",
            content: `Summarize this legal text in 3-5 bullet points:

${text2.substring(0, 2e3)}`
          }
        ],
        stream: false
      });
      return response.message.content;
    } catch (error) {
      console.error("Summarization error:", error);
      throw new Error("Summarization failed");
    }
  }
  async listModels() {
    try {
      const response = await this.ollama.list();
      return response.models.map((model) => ({
        name: model.name,
        size: model.size,
        modified_at: model.modified_at,
        digest: model.digest
      }));
    } catch (error) {
      console.error("List models error:", error);
      throw new Error("Failed to list models");
    }
  }
};
var aiService = new RealAIService();

// server/routes/ai.ts
var router2 = Router2();
router2.post("/chat", authenticate, async (req, res) => {
  try {
    const { message, context, model = "llama3", mode = "general", stream = false } = req.body;
    const startTime = Date.now();
    if (stream) {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      });
      const _response = await aiService.chatStream(message, {
        ...context,
        model,
        mode,
        onChunk: (chunk) => {
          res.write(chunk);
        }
      });
      res.end();
    } else {
      const response = await aiService.chat(message, {
        ...context,
        model,
        mode
      });
      const processingTime = Date.now() - startTime;
      res.json({
        response,
        content: response,
        model: model === "llama3" ? "llama3.2" : model,
        confidence: 0.85,
        // Mock confidence for now
        processingTime,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  } catch (error) {
    console.error("AI chat error:", error);
    res.status(500).json({ error: error.message || "AI service unavailable" });
  }
});
router2.post("/analyze-document", authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const analysis = await aiService.analyzeDocument(content);
    res.json(analysis);
  } catch (error) {
    console.error("Document analysis error:", error);
    res.status(500).json({ error: error.message || "Analysis failed" });
  }
});
router2.post("/generate-draft", authenticate, async (req, res) => {
  try {
    const { template, data } = req.body;
    const draft = await aiService.generateDraft(template, data);
    res.json({
      content: draft,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Draft generation error:", error);
    res.status(500).json({ error: error.message || "Draft generation failed" });
  }
});
router2.post("/summarize", authenticate, async (req, res) => {
  try {
    const { text: text2 } = req.body;
    const summary = await aiService.summarize(text2);
    res.json({
      summary,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Summarization error:", error);
    res.status(500).json({ error: error.message || "Summarization failed" });
  }
});
router2.get("/models", authenticate, async (req, res) => {
  try {
    const models = await aiService.listModels();
    res.json({
      models,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("List models error:", error);
    res.status(500).json({ error: error.message || "Failed to list models" });
  }
});
var ai_default = router2;

// server/routes/audit.ts
import express from "express";

// server/storage.ts
import { eq as eq3, desc, and as and2, sql as sql3 } from "drizzle-orm";
import crypto4 from "crypto";
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq3(users.id, id));
    return user || void 0;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq3(users.username, username));
    return user || void 0;
  }
  async createUser(insertUser) {
    const userId = `user_${crypto4.randomBytes(8).toString("hex")}`;
    const [user] = await db.insert(users).values({
      ...insertUser,
      id: userId
    }).returning();
    return user;
  }
  async getCases() {
    return await db.select().from(cases).orderBy(desc(cases.updatedAt));
  }
  async getCase(id) {
    const [case_] = await db.select().from(cases).where(eq3(cases.id, id));
    return case_ || void 0;
  }
  async createCase(case_) {
    const [newCase] = await db.insert(cases).values(case_).returning();
    return newCase;
  }
  async updateCase(id, updates) {
    const [updatedCase] = await db.update(cases).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(cases.id, id)).returning();
    return updatedCase || void 0;
  }
  async deleteCase(id) {
    const result = await db.delete(cases).where(eq3(cases.id, id));
    return (result.rowCount || 0) > 0;
  }
  async getDocumentsByCase(caseId) {
    return await db.select().from(documents).where(eq3(documents.caseId, caseId));
  }
  async createDocument(document) {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }
  async updateDocumentOCR(id, ocrData) {
    await db.update(documents).set({
      ocrText: ocrData.extractedText,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq3(documents.id, id));
  }
  async getEventsByCase(caseId) {
    return await db.select().from(events).where(eq3(events.caseId, caseId)).orderBy(desc(events.happenedAt));
  }
  async createEvent(event) {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }
  async getDraftsByCase(caseId) {
    return await db.select().from(drafts).where(eq3(drafts.caseId, caseId)).orderBy(desc(drafts.updatedAt));
  }
  async createDraft(draft) {
    const [newDraft] = await db.insert(drafts).values(draft).returning();
    return newDraft;
  }
  async getConsentsByPerson(personId) {
    return await db.select().from(consents).where(eq3(consents.personId, personId));
  }
  async createConsent(consent) {
    const [newConsent] = await db.insert(consents).values(consent).returning();
    return newConsent;
  }
  async getAuditLog(filters) {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;
    let whereConditions = sql3`1=1`;
    if (filters?.userId) {
      whereConditions = sql3`${whereConditions} AND ${auditLog.userId} = ${filters.userId}`;
    }
    if (filters?.action) {
      whereConditions = sql3`${whereConditions} AND ${auditLog.action} LIKE ${`%${filters.action}%`}`;
    }
    if (filters?.resource) {
      whereConditions = sql3`${whereConditions} AND ${auditLog.resource} = ${filters.resource}`;
    }
    if (filters?.startDate) {
      whereConditions = sql3`${whereConditions} AND ${auditLog.timestamp} >= ${filters.startDate.toISOString()}`;
    }
    if (filters?.endDate) {
      whereConditions = sql3`${whereConditions} AND ${auditLog.timestamp} <= ${filters.endDate.toISOString()}`;
    }
    const entries = await db.select().from(auditLog).where(whereConditions).orderBy(desc(auditLog.timestamp)).limit(limit).offset(offset);
    const [countResult] = await db.select({ count: sql3`count(*)` }).from(auditLog).where(whereConditions);
    const total = countResult?.count || 0;
    return { entries, total };
  }
  async createAuditEntry(entry) {
    let processedEntry = { ...entry };
    if (entry.metadata) {
      const { redacted } = piiRedactor.redactObject(entry.metadata, "audit-system");
      processedEntry.metadata = redacted;
    }
    if (entry.redactedData) {
      const result = piiRedactor.redact(entry.redactedData, "audit-system");
      processedEntry.redactedData = result.redactedText;
    }
    const [newEntry] = await db.insert(auditLog).values(processedEntry).returning();
    return newEntry;
  }
  async getStats() {
    const [activeCasesResult] = await db.select({ count: sql3`count(*)` }).from(cases).where(eq3(cases.status, "active"));
    const [documentsResult] = await db.select({ count: sql3`count(*)` }).from(documents);
    const [auditResult] = await db.select({ count: sql3`count(*)` }).from(auditLog).where(sql3`${auditLog.action} LIKE '%ai%' AND DATE(${auditLog.timestamp}) = CURRENT_DATE`);
    return {
      activeCases: activeCasesResult?.count || 0,
      documentsProcessed: documentsResult?.count || 0,
      aiQueries: auditResult?.count || 0,
      privacyScore: 98
      // Static for now, would be calculated based on compliance metrics
    };
  }
  async getAuditReport(startDate, endDate, filters) {
    let whereConditions = sql3`${auditLog.timestamp} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}`;
    if (filters?.userId) {
      whereConditions = sql3`${whereConditions} AND ${auditLog.userId} = ${filters.userId}`;
    }
    if (filters?.resource) {
      whereConditions = sql3`${whereConditions} AND ${auditLog.resource} = ${filters.resource}`;
    }
    if (filters?.action) {
      whereConditions = sql3`${whereConditions} AND ${auditLog.action} LIKE ${`%${filters.action}%`}`;
    }
    const entries = await db.select().from(auditLog).where(whereConditions).orderBy(desc(auditLog.timestamp)).limit(1e3);
    const summary = {
      total: entries.length,
      byAction: {},
      byResource: {},
      byUser: {},
      byHour: {}
    };
    entries.forEach((entry) => {
      summary.byAction[entry.action] = (summary.byAction[entry.action] || 0) + 1;
      summary.byResource[entry.resource] = (summary.byResource[entry.resource] || 0) + 1;
      if (entry.userId) {
        summary.byUser[entry.userId] = (summary.byUser[entry.userId] || 0) + 1;
      }
      const hour = new Date(entry.timestamp).toISOString().slice(0, 13) + ":00:00.000Z";
      summary.byHour[hour] = (summary.byHour[hour] || 0) + 1;
    });
    return { entries, summary };
  }
  async cleanupOldAuditLogs(retentionDays) {
    const cutoffDate = /* @__PURE__ */ new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const result = await db.delete(auditLog).where(sql3`${auditLog.timestamp} < ${cutoffDate.toISOString()}`);
    return { deleted: result.rowCount || 0 };
  }
  async getAuditLogsByUser(userId, limit = 100) {
    return await db.select().from(auditLog).where(eq3(auditLog.userId, userId)).orderBy(desc(auditLog.timestamp)).limit(limit);
  }
  async getAuditLogsByResource(resource, resourceId, limit = 100) {
    let whereConditions = eq3(auditLog.resource, resource);
    if (resourceId) {
      whereConditions = and2(
        eq3(auditLog.resource, resource),
        eq3(auditLog.resourceId, resourceId)
      );
    }
    return await db.select().from(auditLog).where(whereConditions).orderBy(desc(auditLog.timestamp)).limit(limit);
  }
  // Enhanced document methods with audit logging
  async getAllDocuments() {
    return await db.select().from(documents).orderBy(desc(documents.createdAt));
  }
  async getDocument(id) {
    const [document] = await db.select().from(documents).where(eq3(documents.id, id));
    return document || void 0;
  }
  async getDocumentMetadata(id) {
    const [document] = await db.select().from(documents).where(eq3(documents.id, id));
    if (!document) return null;
    return {
      id: document.id,
      type: document.type,
      source: document.source,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      hasOCR: !!document.ocrText,
      ocrLength: document.ocrText?.length || 0
    };
  }
  async updateDocumentMetadata(id, _metadata) {
    await db.update(documents).set({ updatedAt: /* @__PURE__ */ new Date() }).where(eq3(documents.id, id));
    return this.getDocumentMetadata(id);
  }
  async getDocumentFilePath(id) {
    const [document] = await db.select().from(documents).where(eq3(documents.id, id));
    return document?.path || null;
  }
  async getDocumentOCRStatus(id) {
    const [document] = await db.select().from(documents).where(eq3(documents.id, id));
    if (!document) return null;
    return {
      hasOCR: !!document.ocrText,
      ocrLength: document.ocrText?.length || 0,
      status: document.ocrText ? "completed" : "pending"
    };
  }
  async startOCRProcessing(_id) {
    return {
      status: "started",
      message: "OCR processing started"
    };
  }
  async addDocumentAnnotation(documentId, annotation) {
    return {
      id: `annotation_${Date.now()}`,
      documentId,
      ...annotation
    };
  }
};
var storage = new DatabaseStorage();

// server/routes/audit.ts
import { z as z2 } from "zod";
var router3 = express.Router();
router3.use(authenticate);
router3.use(auditMiddleware);
var auditQuerySchema = z2.object({
  limit: z2.coerce.number().min(1).max(1e3).optional().default(100),
  offset: z2.coerce.number().min(0).optional().default(0),
  userId: z2.string().optional(),
  action: z2.string().optional(),
  resource: z2.string().optional(),
  startDate: z2.string().datetime().optional(),
  endDate: z2.string().datetime().optional(),
  severity: z2.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]).optional()
});
var auditReportSchema = z2.object({
  startDate: z2.string().datetime(),
  endDate: z2.string().datetime(),
  userId: z2.string().optional(),
  resource: z2.string().optional(),
  action: z2.string().optional(),
  format: z2.enum(["json", "csv"]).optional().default("json")
});
router3.get("/", authorize("admin"), async (req, res) => {
  try {
    const filters = auditQuerySchema.parse(req.query);
    const processedFilters = {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : void 0,
      endDate: filters.endDate ? new Date(filters.endDate) : void 0
    };
    const result = await storage.getAuditLog(processedFilters);
    res.json({
      ...result,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.total > filters.offset + filters.limit
      }
    });
  } catch (error) {
    logError(req, error, { endpoint: "GET /api/audit" });
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});
router3.get("/report", authorize("admin"), async (req, res) => {
  try {
    const params = auditReportSchema.parse(req.query);
    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    if (startDate >= endDate) {
      return res.status(400).json({ error: "Start date must be before end date" });
    }
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1e3 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return res.status(400).json({ error: "Report period cannot exceed 365 days" });
    }
    const report = await storage.getAuditReport(startDate, endDate, {
      userId: params.userId,
      resource: params.resource,
      action: params.action
    });
    logExportOperation(
      req,
      "audit-report",
      report.entries.map((e) => e.id),
      params.format,
      true
      // Contains PII
    );
    if (params.format === "csv") {
      const csvData = generateAuditCSV(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-report-${startDate.toISOString().split("T")[0]}-${endDate.toISOString().split("T")[0]}.csv"`);
      res.send(csvData);
    } else {
      res.json({
        ...report,
        metadata: {
          generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          generatedBy: req.user?.id,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            days: daysDiff
          },
          filters: {
            userId: params.userId,
            resource: params.resource,
            action: params.action
          }
        }
      });
    }
  } catch (error) {
    logError(req, error, { endpoint: "GET /api/audit/report" });
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    res.status(500).json({ error: "Failed to generate audit report" });
  }
});
router3.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    if (req.user?.role !== "admin" && req.user?.id !== userId) {
      return res.status(403).json({ error: "Cannot view other users audit logs" });
    }
    const entries = await storage.getAuditLogsByUser(userId, limit);
    res.json({ entries, total: entries.length });
  } catch (error) {
    logError(req, error, { endpoint: "GET /api/audit/user/:userId" });
    res.status(500).json({ error: "Failed to fetch user audit logs" });
  }
});
router3.get("/resource/:resource", authorize("admin"), async (req, res) => {
  try {
    const { resource } = req.params;
    const { resourceId } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const entries = await storage.getAuditLogsByResource(
      resource,
      resourceId,
      limit
    );
    res.json({ entries, total: entries.length });
  } catch (error) {
    logError(req, error, { endpoint: "GET /api/audit/resource/:resource" });
    res.status(500).json({ error: "Failed to fetch resource audit logs" });
  }
});
router3.delete("/cleanup", authorize("admin"), async (req, res) => {
  try {
    const retentionDays = parseInt(req.query.retentionDays) || 7 * 365;
    const confirm = req.query.confirm === "true";
    if (!confirm) {
      return res.status(400).json({
        error: "Confirmation required",
        message: "Add ?confirm=true to proceed with cleanup"
      });
    }
    if (retentionDays < 30) {
      return res.status(400).json({ error: "Retention period cannot be less than 30 days" });
    }
    const result = await storage.cleanupOldAuditLogs(retentionDays);
    req.user && logExportOperation(
      req,
      "audit-cleanup",
      [],
      "deletion",
      true
      // This is a sensitive operation
    );
    res.json({
      message: "Audit log cleanup completed",
      deleted: result.deleted,
      retentionDays
    });
  } catch (error) {
    logError(req, error, { endpoint: "DELETE /api/audit/cleanup" });
    res.status(500).json({ error: "Failed to cleanup audit logs" });
  }
});
router3.get("/stats", authorize("admin"), async (req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
    const [last24HoursStats, last7DaysStats, last30DaysStats] = await Promise.all([
      storage.getAuditReport(last24Hours, now),
      storage.getAuditReport(last7Days, now),
      storage.getAuditReport(last30Days, now)
    ]);
    res.json({
      last24Hours: {
        total: last24HoursStats.summary.total,
        byAction: last24HoursStats.summary.byAction,
        byResource: last24HoursStats.summary.byResource
      },
      last7Days: {
        total: last7DaysStats.summary.total,
        byAction: last7DaysStats.summary.byAction,
        byResource: last7DaysStats.summary.byResource
      },
      last30Days: {
        total: last30DaysStats.summary.total,
        byAction: last30DaysStats.summary.byAction,
        byResource: last30DaysStats.summary.byResource
      },
      generatedAt: now.toISOString()
    });
  } catch (error) {
    logError(req, error, { endpoint: "GET /api/audit/stats" });
    res.status(500).json({ error: "Failed to fetch audit statistics" });
  }
});
function generateAuditCSV(report) {
  const headers = [
    "Timestamp",
    "User ID",
    "Action",
    "Resource",
    "Resource ID",
    "Result",
    "IP Address",
    "User Agent",
    "Details"
  ];
  const csvLines = [headers.join(",")];
  report.entries.forEach((entry) => {
    const metadata = entry.metadata || {};
    const row = [
      entry.timestamp,
      entry.userId,
      entry.action,
      entry.resource,
      entry.resourceId,
      metadata.result || "UNKNOWN",
      metadata.ipAddress || "",
      metadata.userAgent || "",
      JSON.stringify(metadata.details || {}).replace(/"/g, '""')
      // Escape quotes for CSV
    ];
    csvLines.push(row.map((field) => `"${field}"`).join(","));
  });
  return csvLines.join("\n");
}
var audit_default = router3;

// server/routes/auth.ts
import { Router as Router3 } from "express";
import { z as z3 } from "zod";

// server/services/audit.ts
var REDACTED_FIELDS = [
  "password",
  "token",
  "sessionId",
  "creditCard",
  "ssn",
  "nationalInsurance",
  "dateOfBirth",
  "address",
  "phone",
  "email"
];
function redactSensitiveData(data) {
  if (!data) return data;
  if (typeof data === "string") {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }
  if (typeof data === "object") {
    const redacted = {};
    for (const [key, value] of Object.entries(data)) {
      if (REDACTED_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        if (Array.isArray(value)) {
          redacted[key] = value.map(() => "[REDACTED]");
        } else {
          redacted[key] = "[REDACTED]";
        }
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    return redacted;
  }
  return data;
}
function collectRedactedFields(data) {
  if (!data || typeof data !== "object") return [];
  const fields = [];
  for (const key of Object.keys(data)) {
    if (REDACTED_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      fields.push(key);
    } else if (typeof data[key] === "object" && data[key] !== null) {
      const nestedFields = collectRedactedFields(data[key]);
      if (nestedFields.length > 0) {
        fields.push(...nestedFields);
      }
    }
  }
  return [...new Set(fields)];
}
async function auditLog2(entry) {
  try {
    const redactedMetadata = entry.metadata ? redactSensitiveData(entry.metadata) : null;
    const redactedFields = entry.metadata ? collectRedactedFields(entry.metadata) : [];
    await db.insert(auditLog).values({
      ...entry,
      metadata: redactedMetadata,
      redactedData: redactedFields.length > 0 ? redactedFields.join(", ") : null
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

// server/routes/auth.ts
var router4 = Router3();
var registerSchema = z3.object({
  username: z3.string().min(3).max(50),
  password: z3.string().min(8).max(100),
  name: z3.string().min(1).max(100),
  role: z3.enum(["solicitor", "admin", "paralegal", "client"]).default("solicitor")
});
var loginSchema = z3.object({
  username: z3.string(),
  password: z3.string()
});
var changePasswordSchema = z3.object({
  currentPassword: z3.string(),
  newPassword: z3.string().min(8).max(100)
});
router4.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await AuthService.register(data);
    await auditLog2({
      userId: result.user.id,
      action: "user.register",
      resource: "user",
      resourceId: result.user.id,
      metadata: { username: result.user.username, role: result.user.role }
    });
    res.status(201).json({
      user: result.user,
      token: result.token
    });
  } catch (error) {
    if (error instanceof z3.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error instanceof Error) {
      if (error.message === "Username already exists") {
        return res.status(409).json({ error: error.message });
      }
      console.error("Registration error:", error);
      return res.status(500).json({ error: "Registration failed" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});
router4.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await AuthService.login(data.username, data.password);
    await auditLog2({
      userId: result.user.id,
      action: "user.login",
      resource: "session",
      resourceId: result.user.id,
      metadata: { username: result.user.username }
    });
    res.json({
      user: result.user,
      token: result.token
    });
  } catch (error) {
    if (error instanceof z3.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error instanceof Error) {
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: error.message });
      }
      console.error("Login error:", error);
      return res.status(500).json({ error: "Login failed" });
    }
    res.status(500).json({ error: "Login failed" });
  }
});
router4.post("/logout", authenticate, async (req, res) => {
  try {
    await auditLog2({
      userId: req.user.id,
      action: "user.logout",
      resource: "session",
      resourceId: req.user.id,
      metadata: { username: req.user.username }
    });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});
router4.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});
router4.post("/change-password", authenticate, async (req, res) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    const isValid = await AuthService.login(req.user.username, data.currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    await AuthService.updatePassword(req.user.id, data.newPassword);
    await auditLog2({
      userId: req.user.id,
      action: "user.change_password",
      resource: "user",
      resourceId: req.user.id,
      metadata: { username: req.user.username }
    });
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    if (error instanceof z3.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});
router4.post("/refresh", authenticate, async (req, res) => {
  try {
    const token = AuthService.generateToken({
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role
    });
    res.json({ token });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});
var auth_default = router4;

// server/routes/mfa.ts
import express2 from "express";
import rateLimit from "express-rate-limit";
import { z as z4 } from "zod";
var router5 = express2.Router();
var mfaRateLimit = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 10,
  // limit each IP to 10 requests per windowMs
  message: { error: "Too many MFA attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});
var strictMfaRateLimit = rateLimit({
  windowMs: 5 * 60 * 1e3,
  // 5 minutes
  max: 3,
  // limit each IP to 3 requests per windowMs
  message: { error: "Too many verification attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});
var setupTotpSchema = z4.object({
  email: z4.string().email()
});
var verifyTotpSchema = z4.object({
  token: z4.string().length(6).regex(/^\d+$/)
});
var setupSmsSchema = z4.object({
  phoneNumber: z4.string().regex(/^(\+44|0)[1-9]\d{8,9}$/, "Invalid UK phone number")
});
var verifyCodeSchema = z4.object({
  code: z4.string().length(6).regex(/^\d+$/)
});
var verifyBackupCodeSchema = z4.object({
  code: z4.string().length(8).regex(/^[A-Z0-9]+$/)
});
var trustedDeviceSchema = z4.object({
  deviceName: z4.string().min(1).max(100).optional(),
  expirationDays: z4.number().min(1).max(365).optional()
});
function getVerificationContext(req) {
  return {
    userId: req.user.id,
    ipAddress: req.ip || req.connection.remoteAddress || "unknown",
    userAgent: req.get("User-Agent") || "unknown"
  };
}
router5.get("/status", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await mfaService.getMfaStatus(userId);
    const context = getVerificationContext(req);
    const isDeviceTrusted = await mfaService.isDeviceTrusted(userId, context);
    res.json({
      ...status,
      deviceTrusted: isDeviceTrusted
    });
  } catch (error) {
    console.error("MFA status error:", error);
    res.status(500).json({ error: "Failed to get MFA status" });
  }
});
router5.post("/setup/totp", requireAuth, mfaRateLimit, async (req, res) => {
  try {
    const { email } = setupTotpSchema.parse(req.body);
    const userId = req.user.id;
    const setup = await mfaService.setupTotp(userId, email);
    res.json({
      secret: setup.secret,
      qrCode: setup.qrCode,
      backupCodes: setup.backupCodes
    });
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("TOTP setup error:", error);
    res.status(500).json({ error: "Failed to setup TOTP" });
  }
});
router5.post("/setup/totp/verify", requireAuth, strictMfaRateLimit, async (req, res) => {
  try {
    const { token } = verifyTotpSchema.parse(req.body);
    const userId = req.user.id;
    const context = getVerificationContext(req);
    const verified = await mfaService.verifyTotpSetup(userId, token, context);
    if (verified) {
      res.json({ success: true, message: "TOTP setup completed successfully" });
    } else {
      res.status(400).json({ error: "Invalid verification code" });
    }
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("TOTP verification error:", error);
    res.status(500).json({ error: "Failed to verify TOTP" });
  }
});
router5.post("/verify/totp", requireAuth, strictMfaRateLimit, async (req, res) => {
  try {
    const { token } = verifyTotpSchema.parse(req.body);
    const userId = req.user.id;
    const context = getVerificationContext(req);
    const verified = await mfaService.verifyTotp(userId, token, context);
    if (verified) {
      res.json({ success: true, message: "TOTP verified successfully" });
    } else {
      res.status(400).json({ error: "Invalid verification code" });
    }
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("TOTP verification error:", error);
    res.status(500).json({ error: "Failed to verify TOTP" });
  }
});
router5.post("/send/sms", requireAuth, mfaRateLimit, async (req, res) => {
  try {
    const { phoneNumber } = setupSmsSchema.parse(req.body);
    const userId = req.user.id;
    const sent = await mfaService.sendSmsCode(userId, phoneNumber);
    if (sent) {
      res.json({ success: true, message: "SMS code sent successfully" });
    } else {
      res.status(429).json({ error: "Rate limit exceeded" });
    }
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("SMS send error:", error);
    res.status(500).json({ error: "Failed to send SMS code" });
  }
});
router5.post("/verify/sms", requireAuth, strictMfaRateLimit, async (req, res) => {
  try {
    const { code } = verifyCodeSchema.parse(req.body);
    const userId = req.user.id;
    const context = getVerificationContext(req);
    const verified = await mfaService.verifySmsCode(userId, code, context);
    if (verified) {
      res.json({ success: true, message: "SMS code verified successfully" });
    } else {
      res.status(400).json({ error: "Invalid or expired verification code" });
    }
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("SMS verification error:", error);
    res.status(500).json({ error: "Failed to verify SMS code" });
  }
});
router5.post("/send/email", requireAuth, mfaRateLimit, async (req, res) => {
  try {
    const userId = req.user.id;
    const sent = await mfaService.sendEmailCode(userId);
    if (sent) {
      res.json({ success: true, message: "Email code sent successfully" });
    } else {
      res.status(429).json({ error: "Rate limit exceeded or email not configured" });
    }
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ error: "Failed to send email code" });
  }
});
router5.post("/verify/email", requireAuth, strictMfaRateLimit, async (req, res) => {
  try {
    const { code } = verifyCodeSchema.parse(req.body);
    const userId = req.user.id;
    const context = getVerificationContext(req);
    const verified = await mfaService.verifyEmailCode(userId, code, context);
    if (verified) {
      res.json({ success: true, message: "Email code verified successfully" });
    } else {
      res.status(400).json({ error: "Invalid or expired verification code" });
    }
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Failed to verify email code" });
  }
});
router5.post("/verify/backup", requireAuth, strictMfaRateLimit, async (req, res) => {
  try {
    const { code } = verifyBackupCodeSchema.parse(req.body);
    const userId = req.user.id;
    const context = getVerificationContext(req);
    const verified = await mfaService.verifyBackupCode(userId, code, context);
    if (verified) {
      res.json({ success: true, message: "Backup code verified successfully" });
    } else {
      res.status(400).json({ error: "Invalid or already used backup code" });
    }
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Backup code verification error:", error);
    res.status(500).json({ error: "Failed to verify backup code" });
  }
});
router5.post("/trusted-devices", requireAuth, async (req, res) => {
  try {
    const options = trustedDeviceSchema.parse(req.body);
    const userId = req.user.id;
    const context = getVerificationContext(req);
    const deviceFingerprint = await mfaService.addTrustedDevice(userId, context, options);
    res.json({
      success: true,
      message: "Device added as trusted",
      deviceFingerprint
    });
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Add trusted device error:", error);
    res.status(500).json({ error: "Failed to add trusted device" });
  }
});
router5.get("/trusted-devices", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const devices = await mfaService.getTrustedDevices(userId);
    res.json({ devices });
  } catch (error) {
    console.error("Get trusted devices error:", error);
    res.status(500).json({ error: "Failed to get trusted devices" });
  }
});
router5.delete("/trusted-devices/:deviceId", requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;
    const removed = await mfaService.removeTrustedDevice(userId, deviceId);
    if (removed) {
      res.json({ success: true, message: "Trusted device removed" });
    } else {
      res.status(404).json({ error: "Trusted device not found" });
    }
  } catch (error) {
    console.error("Remove trusted device error:", error);
    res.status(500).json({ error: "Failed to remove trusted device" });
  }
});
router5.post("/backup-codes/regenerate", requireAuth, mfaRateLimit, async (req, res) => {
  try {
    const userId = req.user.id;
    const backupCodes = await mfaService.generateNewBackupCodes(userId);
    res.json({
      success: true,
      message: "New backup codes generated",
      backupCodes
    });
  } catch (error) {
    console.error("Regenerate backup codes error:", error);
    res.status(500).json({ error: "Failed to generate new backup codes" });
  }
});
router5.post("/disable", requireAuth, strictMfaRateLimit, async (req, res) => {
  try {
    const userId = req.user.id;
    const adminUserId = req.user.id;
    await mfaService.disableMfa(userId, adminUserId);
    res.json({ success: true, message: "MFA disabled successfully" });
  } catch (error) {
    console.error("Disable MFA error:", error);
    res.status(500).json({ error: "Failed to disable MFA" });
  }
});
router5.get("/device/trusted", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const context = getVerificationContext(req);
    const trusted = await mfaService.isDeviceTrusted(userId, context);
    res.json({ trusted });
  } catch (error) {
    console.error("Check trusted device error:", error);
    res.status(500).json({ error: "Failed to check device trust status" });
  }
});
router5.post("/complete", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const mfaEnabled = await mfaService.isMfaEnabled(userId);
    if (!mfaEnabled) {
      return res.status(400).json({ error: "MFA not enabled for this user" });
    }
    res.json({
      success: true,
      message: "MFA verification completed",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Complete MFA error:", error);
    res.status(500).json({ error: "Failed to complete MFA verification" });
  }
});
var mfa_default = router5;

// server/routes/upload.ts
import { Router as Router4 } from "express";

// server/services/upload.ts
import multer from "multer";
import path3 from "path";
import crypto5 from "crypto";
import { promises as fs } from "fs";
import { eq as eq4 } from "drizzle-orm";
var UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
var ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg"];
var MAX_FILE_SIZE = 10 * 1024 * 1024;
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}
ensureUploadDir();
var storage2 = multer.diskStorage({
  destination: async (req, file, cb) => {
    const caseId = req.body.caseId || "uncategorized";
    const caseDir = path3.join(UPLOAD_DIR, caseId);
    try {
      await fs.access(caseDir);
    } catch {
      await fs.mkdir(caseDir, { recursive: true });
    }
    cb(null, caseDir);
  },
  filename: (req, file, cb) => {
    const timestamp2 = Date.now();
    const randomHash = crypto5.randomBytes(8).toString("hex");
    const ext = path3.extname(file.originalname).toLowerCase();
    const safeName = file.originalname.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
    const filename = `${timestamp2}_${randomHash}_${safeName}`;
    cb(null, filename);
  }
});
var fileFilter = (req, file, cb) => {
  const ext = path3.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`));
  }
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/jpg"
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Invalid file MIME type"));
  }
  cb(null, true);
};
var upload = multer({
  storage: storage2,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10
    // Max 10 files per upload
  }
});
async function calculateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto5.createHash("sha256").update(fileBuffer).digest("hex");
}
async function saveDocumentMetadata(file, caseId, documentType, source, userId) {
  const filePath = file.path;
  const hash = await calculateFileHash(filePath);
  const [existing] = await db.select().from(documents).where(eq4(documents.hash, hash)).limit(1);
  if (existing) {
    await fs.unlink(filePath);
    throw new Error(`Duplicate file detected. This file already exists as document ${existing.id}`);
  }
  const documentData = {
    caseId,
    type: documentType,
    source,
    path: filePath,
    hash,
    ocrText: null
    // Will be populated by OCR service later
  };
  const [newDocument] = await db.insert(documents).values(documentData).returning();
  return newDocument;
}
async function deleteDocument(documentId) {
  const [document] = await db.select().from(documents).where(eq4(documents.id, documentId)).limit(1);
  if (!document) {
    return false;
  }
  try {
    await fs.unlink(document.path);
  } catch (error) {
    console.error(`Failed to delete file ${document.path}:`, error);
  }
  await db.delete(documents).where(eq4(documents.id, documentId));
  return true;
}
async function getDocumentFile(documentId) {
  const [document] = await db.select().from(documents).where(eq4(documents.id, documentId)).limit(1);
  if (!document) {
    return null;
  }
  try {
    await fs.access(document.path);
  } catch {
    return null;
  }
  const ext = path3.extname(document.path).toLowerCase();
  const mimeTypes = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
  };
  return {
    path: document.path,
    mimetype: mimeTypes[ext] || "application/octet-stream"
  };
}

// server/services/ocr.ts
import { createWorker } from "tesseract.js";
import fs2 from "fs/promises";
import path4 from "path";

// server/services/ai.ts
import { Ollama as Ollama2 } from "ollama";
import { sql as sql4 } from "drizzle-orm";
var AIService = class {
  constructor() {
    this.embeddingModel = "nomic-embed-text";
    this.chatModel = "llama3.2";
    this.chunkSize = 1e3;
    this.chunkOverlap = 200;
    this.ollama = new Ollama2({
      host: process.env.OLLAMA_HOST || "http://localhost:11434"
    });
  }
  async initialize() {
    try {
      const models = await this.ollama.list();
      const modelNames = models.models.map((m) => m.name);
      if (!modelNames.some((name) => name.includes(this.embeddingModel))) {
        console.log(`Pulling embedding model ${this.embeddingModel}...`);
        await this.ollama.pull({ model: this.embeddingModel });
      }
      if (!modelNames.some((name) => name.includes(this.chatModel))) {
        console.log(`Pulling chat model ${this.chatModel}...`);
        await this.ollama.pull({ model: this.chatModel });
      }
      console.log("AI Service initialized with Ollama");
    } catch (error) {
      console.error("Failed to initialize AI service:", error);
      console.log("AI features will be limited. Please ensure Ollama is running.");
    }
  }
  // Split text into chunks for embedding
  chunkText(text2) {
    const chunks = [];
    const sentences = text2.match(/[^.!?]+[.!?]+/g) || [text2];
    let currentChunk = "";
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          const words = currentChunk.split(" ");
          const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 5));
          currentChunk = overlapWords.join(" ") + " " + sentence;
        } else {
          chunks.push(sentence.substring(0, this.chunkSize));
          currentChunk = sentence.substring(this.chunkSize - this.chunkOverlap);
        }
      } else {
        currentChunk += " " + sentence;
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }
  // Generate embeddings for text
  async generateEmbedding(text2) {
    try {
      const response = await this.ollama.embeddings({
        model: this.embeddingModel,
        prompt: text2
      });
      return response.embedding;
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      return new Array(384).fill(0);
    }
  }
  // Process and store document embeddings
  async processDocumentEmbeddings(documentId, text2) {
    try {
      const chunks = this.chunkText(text2);
      console.log(`Processing ${chunks.length} chunks for document ${documentId}`);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.generateEmbedding(chunk);
        await db.insert(embeddings).values({
          documentId,
          chunkIx: i,
          vector: embedding,
          // pgvector will handle the conversion
          meta: {
            text: chunk.substring(0, 500),
            // Store first 500 chars for reference
            length: chunk.length,
            position: i,
            total: chunks.length
          }
        });
        console.log(`Processed chunk ${i + 1}/${chunks.length} for document ${documentId}`);
      }
    } catch (error) {
      console.error(`Failed to process embeddings for document ${documentId}:`, error);
      throw error;
    }
  }
  // Semantic search using vector similarity
  async semanticSearch(query, caseId, limit = 10) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      let searchQuery = sql4`
        SELECT 
          e.document_id,
          e.chunk_ix,
          e.meta,
          e.vector <=> ${JSON.stringify(queryEmbedding)}::vector as distance,
          d.path,
          d.type,
          d.case_id
        FROM embeddings e
        JOIN documents d ON e.document_id = d.id
      `;
      if (caseId) {
        searchQuery = sql4`${searchQuery} WHERE d.case_id = ${caseId}`;
      }
      searchQuery = sql4`${searchQuery}
        ORDER BY distance
        LIMIT ${limit}
      `;
      const results = await db.execute(searchQuery);
      return results.rows.map((row) => ({
        text: row.meta?.text || "",
        score: 1 - row.distance,
        // Convert distance to similarity score
        documentId: row.document_id,
        metadata: {
          chunkIndex: row.chunk_ix,
          documentPath: row.path,
          documentType: row.type,
          caseId: row.case_id
        }
      }));
    } catch (error) {
      console.error("Semantic search failed:", error);
      return [];
    }
  }
  // Generate legal document draft
  async generateDraft(prompt, context) {
    try {
      const systemPrompt = `You are a UK legal assistant specializing in trauma-informed legal practice. 
      You help draft legal documents that are clear, compassionate, and legally sound. 
      Always consider the emotional impact on vulnerable clients while maintaining professional standards.`;
      const fullPrompt = context ? `Context:
${context}

Request: ${prompt}` : prompt;
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: fullPrompt }
        ],
        options: {
          temperature: 0.7,
          top_p: 0.9
        }
      });
      return response.message.content;
    } catch (error) {
      console.error("Failed to generate draft:", error);
      throw new Error("AI draft generation failed");
    }
  }
  // Analyze document for key information
  async analyzeDocument(text2, analysisType) {
    try {
      const prompts = {
        summary: "Provide a concise summary of this legal document, highlighting key points and implications.",
        entities: "Extract all persons, organizations, dates, locations, and legal references mentioned in this document. Format as JSON.",
        risks: "Identify potential legal risks, compliance issues, and areas requiring immediate attention in this document.",
        timeline: "Create a chronological timeline of events mentioned in this document. Include dates and key events."
      };
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: "You are a UK legal expert analyzing documents for a law firm. Be precise and thorough."
          },
          {
            role: "user",
            content: `${prompts[analysisType]}

Document:
${text2.substring(0, 8e3)}`
          }
        ],
        options: {
          temperature: 0.3,
          top_p: 0.95
        }
      });
      if (analysisType === "entities") {
        try {
          return JSON.parse(response.message.content);
        } catch {
          return { raw: response.message.content };
        }
      }
      return response.message.content;
    } catch (error) {
      console.error(`Document analysis failed (${analysisType}):`, error);
      throw new Error(`Failed to analyze document: ${error}`);
    }
  }
  // Answer questions about a case
  async answerQuestion(question, caseId) {
    try {
      const relevantChunks = await this.semanticSearch(question, caseId, 5);
      const context = relevantChunks.map((chunk) => chunk.text).join("\n\n---\n\n");
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: `You are a UK legal assistant. Answer questions based on the provided case documents. 
            If the information is not in the context, say so. Be accurate and cite relevant parts of the documents.`
          },
          {
            role: "user",
            content: `Context from case documents:
${context}

Question: ${question}`
          }
        ],
        options: {
          temperature: 0.5,
          top_p: 0.95
        }
      });
      return response.message.content;
    } catch (error) {
      console.error("Failed to answer question:", error);
      throw new Error("AI question answering failed");
    }
  }
};
var aiService2 = new AIService();
setTimeout(() => {
  if (process.env.ENABLE_AI_FEATURES === "true") {
    aiService2.initialize().catch(console.error);
  }
}, 5e3);

// server/services/ocr.ts
var OCRService = class {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }
  async initialize() {
    if (this.isInitialized) return;
    try {
      this.worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      this.isInitialized = true;
      console.log("OCR Service initialized");
    } catch (error) {
      console.error("Failed to initialize OCR service:", error);
      throw error;
    }
  }
  async processImage(filePath) {
    const startTime = Date.now();
    if (!this.worker) {
      await this.initialize();
    }
    try {
      const result = await this.worker.recognize(filePath);
      return {
        text: result.data.text,
        confidence: result.data.confidence,
        language: result.data.language,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error("OCR processing failed:", error);
      throw new Error(`OCR processing failed: ${error}`);
    }
  }
  async processPDF(_filePath) {
    const startTime = Date.now();
    return {
      text: "PDF processing temporarily disabled",
      pages: 0,
      processingTime: Date.now() - startTime
    };
  }
  async processDocument(filePath, mimeType) {
    const ext = path4.extname(filePath).toLowerCase();
    if (mimeType === "application/pdf" || ext === ".pdf") {
      return this.processPDF(filePath);
    }
    const imageTypes = [".jpg", ".jpeg", ".png", ".tiff", ".bmp"];
    if (imageTypes.includes(ext) || mimeType.startsWith("image/")) {
      return this.processImage(filePath);
    }
    if (mimeType.startsWith("text/") || [".txt", ".md"].includes(ext)) {
      const text2 = await fs2.readFile(filePath, "utf-8");
      return {
        text: text2,
        processingTime: 0
      };
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  async processAndStore(documentId, filePath, mimeType) {
    try {
      const ocrResult = await this.processDocument(filePath, mimeType);
      await storage.updateDocumentOCR(documentId, {
        extractedText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        pages: ocrResult.pages,
        processingTime: ocrResult.processingTime
      });
      if (ocrResult.text && ocrResult.text.trim().length > 0) {
        console.log(
          `Document ${documentId} processed: ${ocrResult.text.length} characters extracted`
        );
        try {
          await aiService2.processDocumentEmbeddings(documentId, ocrResult.text);
          console.log(`Embeddings generated for document ${documentId}`);
        } catch (embeddingError) {
          console.error(
            `Failed to generate embeddings for document ${documentId}:`,
            embeddingError
          );
        }
      }
    } catch (error) {
      console.error(`Failed to process document ${documentId}:`, error);
      await storage.updateDocumentOCR(documentId, {
        extractedText: null,
        ocrError: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }
  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
};
var ocrService = new OCRService();
setTimeout(() => {
  if (process.env.ENABLE_OCR === "true") {
    ocrService.initialize().catch(console.error);
  }
}, 5e3);
process.on("SIGINT", async () => {
  await ocrService.cleanup();
  process.exit();
});
process.on("SIGTERM", async () => {
  await ocrService.cleanup();
  process.exit();
});

// server/routes/upload.ts
import path5 from "path";
import { createReadStream } from "fs";
var router6 = Router4();
router6.post(
  "/upload/document",
  authenticate,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const { caseId, documentType = "other", source = "upload" } = req.body;
      if (!caseId) {
        return res.status(400).json({ message: "Case ID is required" });
      }
      const case_ = await storage.getCase(caseId);
      if (!case_) {
        return res.status(404).json({ message: "Case not found" });
      }
      const document = await saveDocumentMetadata(
        req.file,
        caseId,
        documentType,
        source,
        req.user.id
      );
      await auditLog2({
        userId: req.user.id,
        action: "document.uploaded",
        resource: "document",
        resourceId: document.id,
        metadata: {
          caseId,
          filename: req.file.originalname,
          size: req.file.size,
          type: documentType
        }
      });
      ocrService.processAndStore(
        document.id,
        req.file.path,
        req.file.mimetype
      ).catch((error) => {
        console.error(`OCR processing failed for document ${document.id}:`, error);
      });
      res.json({
        message: "Document uploaded successfully",
        document: {
          id: document.id,
          filename: req.file.originalname,
          size: req.file.size,
          type: documentType,
          uploadedAt: document.createdAt,
          ocrStatus: "processing"
        }
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to upload document"
      });
    }
  }
);
router6.post(
  "/upload/documents",
  authenticate,
  upload.array("files", 10),
  async (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }
      const { caseId, documentType = "other", source = "upload" } = req.body;
      if (!caseId) {
        return res.status(400).json({ message: "Case ID is required" });
      }
      const case_ = await storage.getCase(caseId);
      if (!case_) {
        return res.status(404).json({ message: "Case not found" });
      }
      const uploadedDocuments = [];
      const errors = [];
      for (const file of files) {
        try {
          const document = await saveDocumentMetadata(
            file,
            caseId,
            documentType,
            source,
            req.user.id
          );
          uploadedDocuments.push({
            id: document.id,
            filename: file.originalname,
            size: file.size,
            type: documentType,
            uploadedAt: document.createdAt
          });
          ocrService.processAndStore(
            document.id,
            file.path,
            file.mimetype
          ).catch((error) => {
            console.error(`OCR processing failed for document ${document.id}:`, error);
          });
          await auditLog2({
            userId: req.user.id,
            action: "document.uploaded",
            resource: "document",
            resourceId: document.id,
            metadata: {
              caseId,
              filename: file.originalname,
              size: file.size,
              type: documentType
            }
          });
        } catch (error) {
          errors.push({
            filename: file.originalname,
            error: error instanceof Error ? error.message : "Upload failed"
          });
        }
      }
      res.json({
        message: `Uploaded ${uploadedDocuments.length} of ${files.length} documents`,
        documents: uploadedDocuments,
        errors: errors.length > 0 ? errors : void 0
      });
    } catch (error) {
      console.error("Batch upload error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to upload documents"
      });
    }
  }
);
router6.get("/documents/:id/download", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const documents2 = await storage.getDocumentsByCase("");
    const document = documents2.find((d) => d.id === id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    const fileInfo = await getDocumentFile(id);
    if (!fileInfo) {
      return res.status(404).json({ message: "Document file not found" });
    }
    await auditLog2({
      userId: req.user.id,
      action: "document.downloaded",
      resource: "document",
      resourceId: id,
      metadata: {
        path: "[REDACTED]"
      }
    });
    const filename = path5.basename(fileInfo.path);
    res.setHeader("Content-Type", fileInfo.mimetype);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    const stream = createReadStream(fileInfo.path);
    stream.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to download document"
    });
  }
});
router6.delete("/documents/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const deleted = await deleteDocument(id);
    if (!deleted) {
      return res.status(404).json({ message: "Document not found" });
    }
    await auditLog2({
      userId: req.user.id,
      action: "document.deleted",
      resource: "document",
      resourceId: id,
      metadata: {}
    });
    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to delete document"
    });
  }
});
router6.get("/upload/status", authenticate, async (req, res) => {
  res.json({
    maxFileSize: 10 * 1024 * 1024,
    // 10MB
    maxFiles: 10,
    allowedTypes: [".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg"],
    storageUsed: 0,
    // Would calculate actual usage
    storageLimit: 1024 * 1024 * 1024
    // 1GB limit
  });
});
var upload_default = router6;

// server/routes.ts
async function registerRoutes(app2) {
  app2.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime()
    });
  });
  app2.use("/api/auth", auth_default);
  app2.use("/api/mfa", mfa_default);
  app2.use("/api", checkMfaRequirement);
  app2.use("/api", upload_default);
  app2.use("/api/ai", ai_default);
  app2.use("/api", agents_default);
  app2.use("/api/audit", audit_default);
  app2.get("/api/cases", authenticate, async (req, res) => {
    try {
      const cases2 = await storage.getCases();
      res.json(cases2);
    } catch {
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });
  app2.get("/api/cases/:id", authenticate, async (req, res) => {
    try {
      const case_ = await storage.getCase(req.params.id);
      if (!case_) {
        return res.status(404).json({ error: "Case not found" });
      }
      res.json(case_);
    } catch {
      res.status(500).json({ error: "Failed to fetch case" });
    }
  });
  app2.post("/api/cases", authenticate, async (req, res) => {
    try {
      const validatedData = insertCaseSchema.parse(req.body);
      const newCase = await storage.createCase(validatedData);
      logDataModification(req, "CREATE", "cases", newCase.id, void 0, newCase);
      res.status(201).json(newCase);
    } catch (_error) {
      logError(req, _error, { operation: "create_case", data: req.body });
      if (_error instanceof z5.ZodError) {
        return res.status(400).json({ error: "Invalid case data", details: _error.errors });
      }
      res.status(500).json({ error: "Failed to create case" });
    }
  });
  app2.get("/api/cases/:caseId/documents", async (req, res) => {
    try {
      const documents2 = await storage.getDocumentsByCase(req.params.caseId);
      res.json(documents2);
    } catch {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });
  app2.post("/api/cases/:caseId/documents", async (req, res) => {
    try {
      const validatedData = insertDocumentSchema.parse({
        ...req.body,
        caseId: req.params.caseId
      });
      const newDocument = await storage.createDocument(validatedData);
      await storage.createAuditEntry({
        userId: "system",
        action: "document_uploaded",
        resource: "document",
        resourceId: newDocument.id
      });
      res.status(201).json(newDocument);
    } catch (_error) {
      if (_error instanceof z5.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: _error.errors });
      }
      res.status(500).json({ error: "Failed to upload document" });
    }
  });
  app2.get("/api/cases/:caseId/events", async (req, res) => {
    try {
      const events2 = await storage.getEventsByCase(req.params.caseId);
      res.json(events2);
    } catch {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });
  app2.post("/api/cases/:caseId/events", async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse({
        ...req.body,
        caseId: req.params.caseId
      });
      const newEvent = await storage.createEvent(validatedData);
      res.status(201).json(newEvent);
    } catch (_error) {
      if (_error instanceof z5.ZodError) {
        return res.status(400).json({ error: "Invalid event data", details: _error.errors });
      }
      res.status(500).json({ error: "Failed to create event" });
    }
  });
  app2.get("/api/cases/:caseId/drafts", async (req, res) => {
    try {
      const drafts2 = await storage.getDraftsByCase(req.params.caseId);
      res.json(drafts2);
    } catch {
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });
  app2.post("/api/cases/:caseId/drafts", async (req, res) => {
    try {
      const validatedData = insertDraftSchema.parse({
        ...req.body,
        caseId: req.params.caseId
      });
      const newDraft = await storage.createDraft(validatedData);
      await storage.createAuditEntry({
        userId: "system",
        action: "draft_created",
        resource: "draft",
        resourceId: newDraft.id
      });
      res.status(201).json(newDraft);
    } catch (_error) {
      if (_error instanceof z5.ZodError) {
        return res.status(400).json({ error: "Invalid draft data", details: _error.errors });
      }
      res.status(500).json({ error: "Failed to create draft" });
    }
  });
  app2.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  app2.get("/api/audit", async (req, res) => {
    try {
      const auditEntries = await storage.getAuditLog();
      res.json(auditEntries);
    } catch {
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });
  app2.get("/api/documents", authenticate, async (req, res) => {
    try {
      const documents2 = await storage.getAllDocuments();
      res.json(documents2);
    } catch {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });
  app2.get("/api/documents/:id", authenticate, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch {
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });
  app2.get("/api/documents/:id/metadata", authenticate, async (req, res) => {
    try {
      const metadata = await storage.getDocumentMetadata(req.params.id);
      if (!metadata) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(metadata);
    } catch {
      res.status(500).json({ error: "Failed to fetch document metadata" });
    }
  });
  app2.patch("/api/documents/:id/metadata", authenticate, async (req, res) => {
    try {
      const updatedMetadata = await storage.updateDocumentMetadata(req.params.id, req.body);
      await storage.createAuditEntry({
        userId: req.user?.id || "system",
        action: "document_metadata_updated",
        resource: "document",
        resourceId: req.params.id
      });
      res.json(updatedMetadata);
    } catch {
      res.status(500).json({ error: "Failed to update document metadata" });
    }
  });
  app2.get("/api/documents/:id/view", authenticate, async (req, res) => {
    try {
      const filePath = await storage.getDocumentFilePath(req.params.id);
      if (!filePath) {
        return res.status(404).json({ error: "Document file not found" });
      }
      res.json({ message: "Document viewer would display file", path: filePath });
    } catch {
      res.status(500).json({ error: "Failed to view document" });
    }
  });
  app2.get("/api/documents/:id/ocr-status", authenticate, async (req, res) => {
    try {
      const ocrStatus = await storage.getDocumentOCRStatus(req.params.id);
      if (!ocrStatus) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(ocrStatus);
    } catch {
      res.status(500).json({ error: "Failed to get OCR status" });
    }
  });
  app2.post("/api/documents/:id/ocr", authenticate, async (req, res) => {
    try {
      const result = await storage.startOCRProcessing(req.params.id);
      await storage.createAuditEntry({
        userId: req.user?.id || "system",
        action: "ocr_processing_started",
        resource: "document",
        resourceId: req.params.id
      });
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to start OCR processing" });
    }
  });
  app2.post("/api/documents/:id/annotations", authenticate, async (req, res) => {
    try {
      const annotation = await storage.addDocumentAnnotation(req.params.id, {
        ...req.body,
        author: req.user?.username || "anonymous",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.status(201).json(annotation);
    } catch {
      res.status(500).json({ error: "Failed to add annotation" });
    }
  });
  app2.get("/api/ai-activity", async (req, res) => {
    try {
      const activities = [
        {
          id: "1",
          description: "OCR processing completed for document: contract_draft_v2.pdf",
          timestamp: new Date(Date.now() - 2 * 60 * 1e3).toISOString(),
          type: "ocr"
        },
        {
          id: "2",
          description: "RAG search indexed 47 new document chunks",
          timestamp: new Date(Date.now() - 5 * 60 * 1e3).toISOString(),
          type: "rag"
        },
        {
          id: "3",
          description: "Draft generated: Response letter (empathetic tone)",
          timestamp: new Date(Date.now() - 12 * 60 * 1e3).toISOString(),
          type: "draft"
        },
        {
          id: "4",
          description: "Privacy audit completed - all data redacted appropriately",
          timestamp: new Date(Date.now() - 18 * 60 * 1e3).toISOString(),
          type: "privacy"
        }
      ];
      res.json(activities);
    } catch {
      res.status(500).json({ error: "Failed to fetch AI activity" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express3 from "express";
import fs3 from "fs";
import path7 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import react from "@vitejs/plugin-react";
import path6 from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
var __dirname = path6.dirname(fileURLToPath(import.meta.url));
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path6.resolve(__dirname, "client", "src"),
      "@shared": path6.resolve(__dirname, "shared"),
      "@assets": path6.resolve(__dirname, "attached_assets")
    }
  },
  root: "client",
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1e3
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3333",
        changeOrigin: true
      }
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith("/api")) {
      return next();
    }
    try {
      const clientTemplate = path7.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs3.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path7.resolve(import.meta.dirname, "public");
  if (!fs3.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express3.static(distPath));
  app2.use("*", (req, res) => {
    if (req.originalUrl.startsWith("/api")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path7.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import dotenv2 from "dotenv";
dotenv2.config();
var app = express4();
app.use(express4.json());
app.use(express4.urlencoded({ extended: false }));
app.use(auditMiddleware);
app.use((req, res, next) => {
  const start = Date.now();
  const path8 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path8.startsWith("/api")) {
      let logLine = `${req.method} ${path8} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
