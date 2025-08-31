// Core document interfaces
export interface Document {
  id: string;
  name: string;
  originalName?: string;
  type: string;
  source: string;
  path: string;
  size: number;
  hash: string;
  uploadedAt: string;
  updatedAt: string;
  uploadedBy?: string;
  caseId: string;
  caseName?: string;
  description?: string;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
  
  // OCR Data
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  ocrText?: string;
  ocrProgress?: number;
  ocrProcessedAt?: string;
  
  // Document Analysis
  pageCount?: number;
  wordCount?: number;
  entities?: DocumentEntity[];
  
  // Annotations
  annotations?: DocumentAnnotation[];
  
  // Privacy & Security
  containsPII?: boolean;
  confidentialityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  encryptionStatus?: 'none' | 'at-rest' | 'full';
  accessLog?: DocumentAccessEntry[];
}

export interface DocumentEntity {
  type: string;
  value: string;
  confidence: number;
  page: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DocumentAnnotation {
  id: string;
  type: 'note' | 'highlight' | 'redaction';
  content: string;
  author: string;
  createdAt: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentAccessEntry {
  action: string;
  user: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UploadFile {
  id: string;
  file: File;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  documentId?: string;
  ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  ocrProgress?: number;
}

// Component prop interfaces
export interface DocumentViewerProps {
  documentId?: string;
  documentUrl?: string;
  documentName?: string;
  documentType?: string;
  caseId?: string;
  onClose?: () => void;
  onAnnotationChange?: (annotations: DocumentAnnotation[]) => void;
  readOnly?: boolean;
}

export interface DocumentListProps {
  caseId?: string;
  onDocumentSelect?: (document: Document) => void;
  onDocumentUpload?: () => void;
  selectedDocumentId?: string;
  allowDelete?: boolean;
  compact?: boolean;
  showCaseInfo?: boolean;
}

export interface DocumentUploadProps {
  caseId?: string;
  onUploadComplete?: (documents: any[]) => void;
  onClose?: () => void;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  autoOCR?: boolean;
  showMetadataForm?: boolean;
}

export interface DocumentMetadataProps {
  documentId: string;
  onUpdate?: (metadata: Document) => void;
  onClose?: () => void;
  readOnly?: boolean;
  compact?: boolean;
}

export interface DocumentManagerProps {
  caseId?: string;
  allowUpload?: boolean;
  allowDelete?: boolean;
  showCaseInfo?: boolean;
  defaultView?: 'list' | 'grid';
  compact?: boolean;
  height?: string;
}