import {
  insertCaseSchema,
  insertDocumentSchema,
  insertDraftSchema,
  insertEventSchema,
} from '@shared/schema';
import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { z } from 'zod';
import { logDataModification, logError } from './middleware/audit.js';
import { authenticate } from './middleware/auth.js';
import { checkMfaRequirement } from './middleware/mfa.js';
import agentRoutes from './routes/agents.js';
import aiRoutes from './routes/ai.js';
import auditRoutes from './routes/audit.js';
import authRoutes from './routes/auth.js';
import mfaRoutes from './routes/mfa.js';
import searchRoutes from './routes/search.js';
import uploadRoutes from './routes/upload.js';
import { storage } from './storage';

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint (public)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Auth routes (public)
  app.use('/api/auth', authRoutes);
  
  // Simple auth routes (public) - for testing

  // MFA routes (semi-protected - requires basic auth but not MFA completion)
  app.use('/api/mfa', mfaRoutes);

  // Apply MFA requirement check to all protected routes
  app.use('/api', checkMfaRequirement);

  // Upload routes (protected)
  app.use('/api', uploadRoutes);

  // AI routes (protected) - Real Ollama integration
  app.use('/api/ai', aiRoutes);

  // Agent routes (protected) - Multi-agent system
  app.use('/api', agentRoutes);

  // Audit routes (protected) - Comprehensive audit system
  app.use('/api/audit', auditRoutes);

  // Search routes (protected) - Vector and text search
  app.use('/api', searchRoutes);

  // Cases endpoints (protected)
  app.get('/api/cases', authenticate, async (req, res) => {
    try {
      const cases = await storage.getCases();
      res.json(cases);
    } catch {
      res.status(500).json({ error: 'Failed to fetch cases' });
    }
  });

  app.get('/api/cases/:id', authenticate, async (req, res) => {
    try {
      const case_ = await storage.getCase(req.params.id);
      if (!case_) {
        return res.status(404).json({ error: 'Case not found' });
      }
      res.json(case_);
    } catch {
      res.status(500).json({ error: 'Failed to fetch case' });
    }
  });

  app.post('/api/cases', authenticate, async (req, res) => {
    try {
      const validatedData = insertCaseSchema.parse(req.body);
      const newCase = await storage.createCase(validatedData);

      // Enhanced audit logging with data modification tracking
      logDataModification(req, 'CREATE', 'cases', newCase.id, undefined, newCase);

      res.status(201).json(newCase);
    } catch (_error) {
      logError(req, _error as Error, { operation: 'create_case', data: req.body });
      if (_error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid case data', details: _error.errors });
      }
      res.status(500).json({ error: 'Failed to create case' });
    }
  });

  // Documents endpoints
  app.get('/api/cases/:caseId/documents', async (req, res) => {
    try {
      const documents = await storage.getDocumentsByCase(req.params.caseId);
      res.json(documents);
    } catch {
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  app.post('/api/cases/:caseId/documents', async (req, res) => {
    try {
      const validatedData = insertDocumentSchema.parse({
        ...req.body,
        caseId: req.params.caseId,
      });
      const newDocument = await storage.createDocument(validatedData);

      await storage.createAuditEntry({
        userId: 'system',
        action: 'document_uploaded',
        resource: 'document',
        resourceId: newDocument.id,
      });

      res.status(201).json(newDocument);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid document data', details: _error.errors });
      }
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });

  // Events endpoints
  app.get('/api/cases/:caseId/events', async (req, res) => {
    try {
      const events = await storage.getEventsByCase(req.params.caseId);
      res.json(events);
    } catch {
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  app.post('/api/cases/:caseId/events', async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse({
        ...req.body,
        caseId: req.params.caseId,
      });
      const newEvent = await storage.createEvent(validatedData);
      res.status(201).json(newEvent);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid event data', details: _error.errors });
      }
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  // Drafts endpoints
  app.get('/api/cases/:caseId/drafts', async (req, res) => {
    try {
      const drafts = await storage.getDraftsByCase(req.params.caseId);
      res.json(drafts);
    } catch {
      res.status(500).json({ error: 'Failed to fetch drafts' });
    }
  });

  app.post('/api/cases/:caseId/drafts', async (req, res) => {
    try {
      const validatedData = insertDraftSchema.parse({
        ...req.body,
        caseId: req.params.caseId,
      });
      const newDraft = await storage.createDraft(validatedData);

      await storage.createAuditEntry({
        userId: 'system',
        action: 'draft_created',
        resource: 'draft',
        resourceId: newDraft.id,
      });

      res.status(201).json(newDraft);
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid draft data', details: _error.errors });
      }
      res.status(500).json({ error: 'Failed to create draft' });
    }
  });

  // Stats endpoint
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // Audit log endpoint
  app.get('/api/audit', async (req, res) => {
    try {
      const auditEntries = await storage.getAuditLog();
      res.json(auditEntries);
    } catch {
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  });

  // Enhanced Document API endpoints

  // Get all documents (not case-specific)
  app.get('/api/documents', authenticate, async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch {
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // Get single document with metadata
  app.get('/api/documents/:id', authenticate, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json(document);
    } catch {
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });

  // Get document metadata
  app.get('/api/documents/:id/metadata', authenticate, async (req, res) => {
    try {
      const metadata = await storage.getDocumentMetadata(req.params.id);
      if (!metadata) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json(metadata);
    } catch {
      res.status(500).json({ error: 'Failed to fetch document metadata' });
    }
  });

  // Update document metadata
  app.patch('/api/documents/:id/metadata', authenticate, async (req, res) => {
    try {
      const updatedMetadata = await storage.updateDocumentMetadata(req.params.id, req.body);

      await storage.createAuditEntry({
        userId: req.user?.id || 'system',
        action: 'document_metadata_updated',
        resource: 'document',
        resourceId: req.params.id,
      });

      res.json(updatedMetadata);
    } catch {
      res.status(500).json({ error: 'Failed to update document metadata' });
    }
  });

  // Get document for viewing
  app.get('/api/documents/:id/view', authenticate, async (req, res) => {
    try {
      const filePath = await storage.getDocumentFilePath(req.params.id);
      if (!filePath) {
        return res.status(404).json({ error: 'Document file not found' });
      }

      // In a real implementation, you would stream the file content
      // For now, we'll just return the file path
      res.json({ message: 'Document viewer would display file', path: filePath });
    } catch {
      res.status(500).json({ error: 'Failed to view document' });
    }
  });

  // Get OCR status
  app.get('/api/documents/:id/ocr-status', authenticate, async (req, res) => {
    try {
      const ocrStatus = await storage.getDocumentOCRStatus(req.params.id);
      if (!ocrStatus) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json(ocrStatus);
    } catch {
      res.status(500).json({ error: 'Failed to get OCR status' });
    }
  });

  // Start OCR processing
  app.post('/api/documents/:id/ocr', authenticate, async (req, res) => {
    try {
      const result = await storage.startOCRProcessing(req.params.id);

      await storage.createAuditEntry({
        userId: req.user?.id || 'system',
        action: 'ocr_processing_started',
        resource: 'document',
        resourceId: req.params.id,
      });

      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed to start OCR processing' });
    }
  });

  // Add document annotations
  app.post('/api/documents/:id/annotations', authenticate, async (req, res) => {
    try {
      const annotation = await storage.addDocumentAnnotation(req.params.id, {
        ...req.body,
        author: req.user?.username || 'anonymous',
        createdAt: new Date().toISOString(),
      });

      res.status(201).json(annotation);
    } catch {
      res.status(500).json({ error: 'Failed to add annotation' });
    }
  });

  // AI Activity endpoint (simulated for now)
  app.get('/api/ai-activity', async (req, res) => {
    try {
      // In production, this would fetch real AI activity from a queue or activity log
      const activities = [
        {
          id: '1',
          description: 'OCR processing completed for document: contract_draft_v2.pdf',
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          type: 'ocr',
        },
        {
          id: '2',
          description: 'RAG search indexed 47 new document chunks',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          type: 'rag',
        },
        {
          id: '3',
          description: 'Draft generated: Response letter (empathetic tone)',
          timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          type: 'draft',
        },
        {
          id: '4',
          description: 'Privacy audit completed - all data redacted appropriately',
          timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
          type: 'privacy',
        },
      ];
      res.json(activities);
    } catch {
      res.status(500).json({ error: 'Failed to fetch AI activity' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
