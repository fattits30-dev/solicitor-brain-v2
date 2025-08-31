var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

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
  insertPersonSchema: () => insertPersonSchema,
  insertUserSchema: () => insertUserSchema,
  persons: () => persons,
  personsRelations: () => personsRelations,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, integer, jsonb, vector, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
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
  userId: uuid("user_id").references(() => users.id).notNull(),
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
});

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

// server/storage.ts
import { eq, desc, sql as sql2 } from "drizzle-orm";
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async getCases() {
    return await db.select().from(cases).orderBy(desc(cases.updatedAt));
  }
  async getCase(id) {
    const [case_] = await db.select().from(cases).where(eq(cases.id, id));
    return case_ || void 0;
  }
  async createCase(case_) {
    const [newCase] = await db.insert(cases).values(case_).returning();
    return newCase;
  }
  async updateCase(id, updates) {
    const [updatedCase] = await db.update(cases).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(cases.id, id)).returning();
    return updatedCase || void 0;
  }
  async deleteCase(id) {
    const result = await db.delete(cases).where(eq(cases.id, id));
    return (result.rowCount || 0) > 0;
  }
  async getDocumentsByCase(caseId) {
    return await db.select().from(documents).where(eq(documents.caseId, caseId));
  }
  async createDocument(document) {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }
  async updateDocumentOCR(id, ocrData) {
    await db.update(documents).set({
      ocrText: ocrData.extractedText,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(documents.id, id));
  }
  async getEventsByCase(caseId) {
    return await db.select().from(events).where(eq(events.caseId, caseId)).orderBy(desc(events.happenedAt));
  }
  async createEvent(event) {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }
  async getDraftsByCase(caseId) {
    return await db.select().from(drafts).where(eq(drafts.caseId, caseId)).orderBy(desc(drafts.updatedAt));
  }
  async createDraft(draft) {
    const [newDraft] = await db.insert(drafts).values(draft).returning();
    return newDraft;
  }
  async getConsentsByPerson(personId) {
    return await db.select().from(consents).where(eq(consents.personId, personId));
  }
  async createConsent(consent) {
    const [newConsent] = await db.insert(consents).values(consent).returning();
    return newConsent;
  }
  async getAuditLog() {
    return await db.select().from(auditLog).orderBy(desc(auditLog.timestamp)).limit(100);
  }
  async createAuditEntry(entry) {
    const [newEntry] = await db.insert(auditLog).values(entry).returning();
    return newEntry;
  }
  async getStats() {
    const [activeCasesResult] = await db.select({ count: sql2`count(*)` }).from(cases).where(eq(cases.status, "active"));
    const [documentsResult] = await db.select({ count: sql2`count(*)` }).from(documents);
    const [auditResult] = await db.select({ count: sql2`count(*)` }).from(auditLog).where(sql2`${auditLog.action} LIKE '%ai%' AND DATE(${auditLog.timestamp}) = CURRENT_DATE`);
    return {
      activeCases: activeCasesResult?.count || 0,
      documentsProcessed: documentsResult?.count || 0,
      aiQueries: auditResult?.count || 0,
      privacyScore: 98
      // Static for now, would be calculated based on compliance metrics
    };
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import { z as z3 } from "zod";

// server/routes/auth.ts
import { Router } from "express";
import { z as z2 } from "zod";

// server/services/auth.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq as eq2 } from "drizzle-orm";
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
    const existingUser = await db.select().from(users).where(eq2(users.username, userData.username)).limit(1);
    if (existingUser.length > 0) {
      throw new Error("Username already exists");
    }
    const hashedPassword = await this.hashPassword(userData.password);
    const [newUser] = await db.insert(users).values({
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
    const [user] = await db.select().from(users).where(eq2(users.username, username)).limit(1);
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
    const [user] = await db.select().from(users).where(eq2(users.id, userId)).limit(1);
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
    }).where(eq2(users.id, userId));
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
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

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
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    return redacted;
  }
  return data;
}
async function auditLog2(entry) {
  try {
    const redactedMetadata = entry.metadata ? redactSensitiveData(entry.metadata) : null;
    const redactedFields = [];
    if (entry.metadata && typeof entry.metadata === "object") {
      for (const key of Object.keys(entry.metadata)) {
        if (REDACTED_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
          redactedFields.push(key);
        }
      }
    }
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
var router = Router();
var registerSchema = z2.object({
  username: z2.string().min(3).max(50),
  password: z2.string().min(8).max(100),
  name: z2.string().min(1).max(100),
  role: z2.enum(["solicitor", "admin", "paralegal", "client"]).default("solicitor")
});
var loginSchema = z2.object({
  username: z2.string(),
  password: z2.string()
});
var changePasswordSchema = z2.object({
  currentPassword: z2.string(),
  newPassword: z2.string().min(8).max(100)
});
router.post("/register", async (req, res) => {
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
    if (error instanceof z2.ZodError) {
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
router.post("/login", async (req, res) => {
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
    if (error instanceof z2.ZodError) {
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
router.post("/logout", authenticate, async (req, res) => {
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
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});
router.post("/change-password", authenticate, async (req, res) => {
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
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});
router.post("/refresh", authenticate, async (req, res) => {
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
var auth_default = router;

// server/routes/upload.ts
import { Router as Router2 } from "express";

// server/services/upload.ts
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { promises as fs } from "fs";
import { eq as eq3 } from "drizzle-orm";
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
    const caseDir = path.join(UPLOAD_DIR, caseId);
    try {
      await fs.access(caseDir);
    } catch {
      await fs.mkdir(caseDir, { recursive: true });
    }
    cb(null, caseDir);
  },
  filename: (req, file, cb) => {
    const timestamp2 = Date.now();
    const randomHash = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = file.originalname.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
    const filename = `${timestamp2}_${randomHash}_${safeName}`;
    cb(null, filename);
  }
});
var fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
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
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}
async function saveDocumentMetadata(file, caseId, documentType, source, userId) {
  const filePath = file.path;
  const hash = await calculateFileHash(filePath);
  const [existing] = await db.select().from(documents).where(eq3(documents.hash, hash)).limit(1);
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
  const [document] = await db.select().from(documents).where(eq3(documents.id, documentId)).limit(1);
  if (!document) {
    return false;
  }
  try {
    await fs.unlink(document.path);
  } catch (error) {
    console.error(`Failed to delete file ${document.path}:`, error);
  }
  await db.delete(documents).where(eq3(documents.id, documentId));
  return true;
}
async function getDocumentFile(documentId) {
  const [document] = await db.select().from(documents).where(eq3(documents.id, documentId)).limit(1);
  if (!document) {
    return null;
  }
  try {
    await fs.access(document.path);
  } catch {
    return null;
  }
  const ext = path.extname(document.path).toLowerCase();
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
import pdfParse from "pdf-parse";
import fs2 from "fs/promises";
import path2 from "path";

// server/services/ai.ts
import { Ollama } from "ollama";
import { sql as sql3 } from "drizzle-orm";
var AIService = class {
  ollama;
  embeddingModel = "nomic-embed-text";
  chatModel = "llama3.2";
  chunkSize = 1e3;
  chunkOverlap = 200;
  constructor() {
    this.ollama = new Ollama({
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
      let searchQuery = sql3`
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
        searchQuery = sql3`${searchQuery} WHERE d.case_id = ${caseId}`;
      }
      searchQuery = sql3`${searchQuery}
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
var aiService = new AIService();
setTimeout(() => {
  if (process.env.ENABLE_AI_FEATURES === "true") {
    aiService.initialize().catch(console.error);
  }
}, 5e3);

// server/services/ocr.ts
var OCRService = class {
  worker = null;
  isInitialized = false;
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
  async processPDF(filePath) {
    const startTime = Date.now();
    try {
      const dataBuffer = await fs2.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return {
        text: data.text,
        pages: data.numpages,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error("PDF processing failed:", error);
      throw new Error(`PDF processing failed: ${error}`);
    }
  }
  async processDocument(filePath, mimeType) {
    const ext = path2.extname(filePath).toLowerCase();
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
        console.log(`Document ${documentId} processed: ${ocrResult.text.length} characters extracted`);
        try {
          await aiService.processDocumentEmbeddings(documentId, ocrResult.text);
          console.log(`Embeddings generated for document ${documentId}`);
        } catch (embeddingError) {
          console.error(`Failed to generate embeddings for document ${documentId}:`, embeddingError);
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
import path3 from "path";
import { createReadStream } from "fs";
var router2 = Router2();
router2.post(
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
router2.post(
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
router2.get("/documents/:id/download", authenticate, async (req, res) => {
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
    const filename = path3.basename(fileInfo.path);
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
router2.delete("/documents/:id", authenticate, async (req, res) => {
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
router2.get("/upload/status", authenticate, async (req, res) => {
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
var upload_default = router2;

// server/routes/ai.ts
import { Router as Router3 } from "express";

// server/services/real-ai.ts
import { Ollama as Ollama2 } from "ollama";
var RealAIService = class {
  ollama;
  embedModel = "nomic-embed-text:latest";
  chatModel = "llama3.2:latest";
  constructor() {
    this.ollama = new Ollama2({
      host: process.env.OLLAMA_HOST || "http://localhost:11434"
    });
  }
  async chat(message, context) {
    try {
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: "You are a helpful legal assistant specializing in UK law. Provide accurate, professional advice while being empathetic to clients."
          },
          {
            role: "user",
            content: message
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
};
var aiService2 = new RealAIService();

// server/routes/ai.ts
var router3 = Router3();
router3.post("/chat", authenticate, async (req, res) => {
  try {
    const { message, context } = req.body;
    const response = await aiService2.chat(message, context);
    res.json({
      response,
      model: "llama3.2",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("AI chat error:", error);
    res.status(500).json({ error: error.message || "AI service unavailable" });
  }
});
router3.post("/analyze-document", authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const analysis = await aiService2.analyzeDocument(content);
    res.json(analysis);
  } catch (error) {
    console.error("Document analysis error:", error);
    res.status(500).json({ error: error.message || "Analysis failed" });
  }
});
router3.post("/generate-draft", authenticate, async (req, res) => {
  try {
    const { template, data } = req.body;
    const draft = await aiService2.generateDraft(template, data);
    res.json({
      content: draft,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Draft generation error:", error);
    res.status(500).json({ error: error.message || "Draft generation failed" });
  }
});
router3.post("/summarize", authenticate, async (req, res) => {
  try {
    const { text: text2 } = req.body;
    const summary = await aiService2.summarize(text2);
    res.json({
      summary,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Summarization error:", error);
    res.status(500).json({ error: error.message || "Summarization failed" });
  }
});
var ai_default = router3;

// server/routes.ts
async function registerRoutes(app2) {
  app2.use("/api/auth", auth_default);
  app2.use("/api", upload_default);
  app2.use("/api/ai", ai_default);
  app2.get("/api/cases", authenticate, async (req, res) => {
    try {
      const cases2 = await storage.getCases();
      res.json(cases2);
    } catch (error) {
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
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch case" });
    }
  });
  app2.post("/api/cases", authenticate, async (req, res) => {
    try {
      const validatedData = insertCaseSchema.parse(req.body);
      const newCase = await storage.createCase(validatedData);
      await storage.createAuditEntry({
        actor: req.user?.username || "system",
        action: "case_created",
        target: newCase.id,
        redactedFields: []
      });
      res.status(201).json(newCase);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ error: "Invalid case data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create case" });
    }
  });
  app2.get("/api/cases/:caseId/documents", async (req, res) => {
    try {
      const documents2 = await storage.getDocumentsByCase(req.params.caseId);
      res.json(documents2);
    } catch (error) {
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
        actor: "system",
        action: "document_uploaded",
        target: newDocument.id,
        redactedFields: []
      });
      res.status(201).json(newDocument);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to upload document" });
    }
  });
  app2.get("/api/cases/:caseId/events", async (req, res) => {
    try {
      const events2 = await storage.getEventsByCase(req.params.caseId);
      res.json(events2);
    } catch (error) {
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
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create event" });
    }
  });
  app2.get("/api/cases/:caseId/drafts", async (req, res) => {
    try {
      const drafts2 = await storage.getDraftsByCase(req.params.caseId);
      res.json(drafts2);
    } catch (error) {
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
        actor: "system",
        action: "draft_created",
        target: newDraft.id,
        redactedFields: []
      });
      res.status(201).json(newDraft);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ error: "Invalid draft data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create draft" });
    }
  });
  app2.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  app2.get("/api/audit", async (req, res) => {
    try {
      const auditEntries = await storage.getAuditLog();
      res.json(auditEntries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit log" });
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
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI activity" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs3 from "fs";
import path5 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path4 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path4.resolve(import.meta.dirname, "client", "src"),
      "@shared": path4.resolve(import.meta.dirname, "shared"),
      "@assets": path4.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path4.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path4.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
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
    try {
      const clientTemplate = path5.resolve(
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
  const distPath = path5.resolve(import.meta.dirname, "public");
  if (!fs3.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path5.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import dotenv2 from "dotenv";
dotenv2.config();
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path6 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path6.startsWith("/api")) {
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
