import { Router } from "express";
import { authenticate as requireAuth } from "../middleware/auth.js";
import { upload, saveDocumentMetadata, getDocumentFile, deleteDocument } from "../services/upload.js";
import { storage } from "../storage.js";
import { auditLog } from "../services/audit.js";
import path from "path";
import { createReadStream } from "fs";

const router = Router();

// Upload single document
router.post(
  "/upload/document",
  requireAuth,
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

      // Verify case exists and user has access
      const case_ = await storage.getCase(caseId);
      if (!case_) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Save document metadata
      const document = await saveDocumentMetadata(
        req.file,
        caseId,
        documentType,
        source,
        req.user!.id
      );

      // Log audit entry
      await auditLog({
        userId: req.user!.id,
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

      res.json({
        message: "Document uploaded successfully",
        document: {
          id: document.id,
          filename: req.file.originalname,
          size: req.file.size,
          type: documentType,
          uploadedAt: document.createdAt
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

// Upload multiple documents
router.post(
  "/upload/documents",
  requireAuth,
  upload.array("files", 10),
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const { caseId, documentType = "other", source = "upload" } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ message: "Case ID is required" });
      }

      // Verify case exists
      const case_ = await storage.getCase(caseId);
      if (!case_) {
        return res.status(404).json({ message: "Case not found" });
      }

      const uploadedDocuments = [];
      const errors = [];

      // Process each file
      for (const file of files) {
        try {
          const document = await saveDocumentMetadata(
            file,
            caseId,
            documentType,
            source,
            req.user!.id
          );

          uploadedDocuments.push({
            id: document.id,
            filename: file.originalname,
            size: file.size,
            type: documentType,
            uploadedAt: document.createdAt
          });

          // Log audit entry
          await AuditService.log({
            userId: req.user!.id,
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
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Batch upload error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to upload documents" 
      });
    }
  }
);

// Get document file
router.get("/documents/:id/download", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get document metadata
    const documents = await storage.getDocumentsByCase("");
    const document = documents.find(d => d.id === id);
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Get file info
    const fileInfo = await getDocumentFile(id);
    if (!fileInfo) {
      return res.status(404).json({ message: "Document file not found" });
    }

    // Log audit entry
    await AuditService.log({
      userId: req.user!.id,
      action: "document.downloaded",
      resource: "document",
      resourceId: id,
      metadata: {
        path: "[REDACTED]"
      }
    });

    // Set headers
    const filename = path.basename(fileInfo.path);
    res.setHeader("Content-Type", fileInfo.mimetype);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    
    // Stream file to response
    const stream = createReadStream(fileInfo.path);
    stream.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : "Failed to download document" 
    });
  }
});

// Delete document
router.delete("/documents/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has permission (admin or document owner)
    if (req.user!.role !== "admin") {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const deleted = await deleteDocument(id);
    
    if (!deleted) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Log audit entry
    await AuditService.log({
      userId: req.user!.id,
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

// Get upload status/limits
router.get("/upload/status", requireAuth, async (req, res) => {
  res.json({
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    allowedTypes: ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'],
    storageUsed: 0, // Would calculate actual usage
    storageLimit: 1024 * 1024 * 1024 // 1GB limit
  });
});

export default router;