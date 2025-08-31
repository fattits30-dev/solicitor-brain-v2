import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCaseSchema, insertDocumentSchema, insertEventSchema, insertDraftSchema } from "@shared/schema";
import { z } from "zod";
import authRoutes from "./routes/auth.js";
import uploadRoutes from "./routes/upload.js";
import aiRoutes from "./routes/ai.js";
import { authenticate, optionalAuth } from "./middleware/auth.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes (public)
  app.use("/api/auth", authRoutes);
  
  // Upload routes (protected)
  app.use("/api", uploadRoutes);
  
  // AI routes (protected) - Real Ollama integration
  app.use("/api/ai", aiRoutes);
  
  // Cases endpoints (protected)
  app.get("/api/cases", authenticate, async (req, res) => {
    try {
      const cases = await storage.getCases();
      res.json(cases);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });

  app.get("/api/cases/:id", authenticate, async (req, res) => {
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

  app.post("/api/cases", authenticate, async (req, res) => {
    try {
      const validatedData = insertCaseSchema.parse(req.body);
      const newCase = await storage.createCase(validatedData);
      
      // Create audit entry
      await storage.createAuditEntry({
        actor: req.user?.username || "system",
        action: "case_created",
        target: newCase.id,
        redactedFields: [],
      });
      
      res.status(201).json(newCase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid case data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create case" });
    }
  });

  // Documents endpoints
  app.get("/api/cases/:caseId/documents", async (req, res) => {
    try {
      const documents = await storage.getDocumentsByCase(req.params.caseId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.post("/api/cases/:caseId/documents", async (req, res) => {
    try {
      const validatedData = insertDocumentSchema.parse({
        ...req.body,
        caseId: req.params.caseId,
      });
      const newDocument = await storage.createDocument(validatedData);
      
      await storage.createAuditEntry({
        actor: "system",
        action: "document_uploaded",
        target: newDocument.id,
        redactedFields: [],
      });
      
      res.status(201).json(newDocument);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Events endpoints
  app.get("/api/cases/:caseId/events", async (req, res) => {
    try {
      const events = await storage.getEventsByCase(req.params.caseId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/cases/:caseId/events", async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse({
        ...req.body,
        caseId: req.params.caseId,
      });
      const newEvent = await storage.createEvent(validatedData);
      res.status(201).json(newEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // Drafts endpoints
  app.get("/api/cases/:caseId/drafts", async (req, res) => {
    try {
      const drafts = await storage.getDraftsByCase(req.params.caseId);
      res.json(drafts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  app.post("/api/cases/:caseId/drafts", async (req, res) => {
    try {
      const validatedData = insertDraftSchema.parse({
        ...req.body,
        caseId: req.params.caseId,
      });
      const newDraft = await storage.createDraft(validatedData);
      
      await storage.createAuditEntry({
        actor: "system",
        action: "draft_created",
        target: newDraft.id,
        redactedFields: [],
      });
      
      res.status(201).json(newDraft);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid draft data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create draft" });
    }
  });

  // Stats endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Audit log endpoint
  app.get("/api/audit", async (req, res) => {
    try {
      const auditEntries = await storage.getAuditLog();
      res.json(auditEntries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // AI Activity endpoint (simulated for now)
  app.get("/api/ai-activity", async (req, res) => {
    try {
      // In production, this would fetch real AI activity from a queue or activity log
      const activities = [
        {
          id: "1",
          description: "OCR processing completed for document: contract_draft_v2.pdf",
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          type: "ocr",
        },
        {
          id: "2", 
          description: "RAG search indexed 47 new document chunks",
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          type: "rag",
        },
        {
          id: "3",
          description: "Draft generated: Response letter (empathetic tone)",
          timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          type: "draft",
        },
        {
          id: "4",
          description: "Privacy audit completed - all data redacted appropriately",
          timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
          type: "privacy",
        },
      ];
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI activity" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
