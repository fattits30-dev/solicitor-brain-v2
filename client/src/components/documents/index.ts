// Document Management Components
export { DocumentViewer } from './DocumentViewer';
export { DocumentList } from './DocumentList';
export { DocumentUpload } from './DocumentUpload';
export { DocumentMetadata } from './DocumentMetadata';
export { DocumentManager } from './DocumentManager';

// Re-export types for convenience
export type {
  DocumentViewerProps,
  DocumentListProps,
  DocumentUploadProps,
  DocumentMetadataProps,
  DocumentManagerProps
} from './types';

// Document-related types and interfaces
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

// Component prop types
interface DocumentViewerProps {
  documentId?: string;
  documentUrl?: string;
  documentName?: string;
  documentType?: string;
  caseId?: string;
  onClose?: () => void;
  onAnnotationChange?: (annotations: DocumentAnnotation[]) => void;
  readOnly?: boolean;
}

interface DocumentListProps {
  caseId?: string;
  onDocumentSelect?: (document: Document) => void;
  onDocumentUpload?: () => void;
  selectedDocumentId?: string;
  allowDelete?: boolean;
  compact?: boolean;
  showCaseInfo?: boolean;
}

interface DocumentUploadProps {
  caseId?: string;
  onUploadComplete?: (documents: any[]) => void;
  onClose?: () => void;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  autoOCR?: boolean;
  showMetadataForm?: boolean;
}

interface DocumentMetadataProps {
  documentId: string;
  onUpdate?: (metadata: Document) => void;
  onClose?: () => void;
  readOnly?: boolean;
  compact?: boolean;
}

interface DocumentManagerProps {
  caseId?: string;
  allowUpload?: boolean;
  allowDelete?: boolean;
  showCaseInfo?: boolean;
  defaultView?: 'list' | 'grid';
  compact?: boolean;
  height?: string;
}

// Document type constants
export const DOCUMENT_TYPES = {
  CONTRACT: 'contract',
  CORRESPONDENCE: 'correspondence',
  EVIDENCE: 'evidence',
  COURT_FILING: 'court-filing',
  INVOICE: 'invoice',
  STATEMENT: 'statement',
  REPORT: 'report',
  PHOTO: 'photo',
  OTHER: 'other'
} as const;

export const DOCUMENT_SOURCES = {
  MANUAL: 'manual',
  EMAIL: 'email',
  SCAN: 'scan',
  EXTERNAL: 'external',
  API: 'api'
} as const;

export const OCR_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export const CONFIDENTIALITY_LEVELS = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  CONFIDENTIAL: 'confidential',
  RESTRICTED: 'restricted'
} as const;

// Utility functions
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const detectDocumentType = (filename: string): string => {
  const name = filename.toLowerCase();
  
  if (name.includes('contract') || name.includes('agreement')) return DOCUMENT_TYPES.CONTRACT;
  if (name.includes('letter') || name.includes('email') || name.includes('correspondence')) return DOCUMENT_TYPES.CORRESPONDENCE;
  if (name.includes('invoice') || name.includes('bill') || name.includes('receipt')) return DOCUMENT_TYPES.INVOICE;
  if (name.includes('statement') || name.includes('account')) return DOCUMENT_TYPES.STATEMENT;
  if (name.includes('report') || name.includes('analysis')) return DOCUMENT_TYPES.REPORT;
  if (name.includes('court') || name.includes('filing') || name.includes('motion')) return DOCUMENT_TYPES.COURT_FILING;
  if (name.match(/\.(jpg|jpeg|png|gif)$/)) return DOCUMENT_TYPES.PHOTO;
  
  return DOCUMENT_TYPES.OTHER;
};

export const getDocumentTypeLabel = (type: string): string => {
  return type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const isImageFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext) : false;
};

export const isPdfFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext === 'pdf';
};

export const isTextFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? ['txt', 'doc', 'docx', 'rtf', 'odt'].includes(ext) : false;
};