# Document Management System

A comprehensive React-based document viewer and management system for the Solicitor Brain v2 application, designed specifically for UK legal document handling with trauma-informed UX principles.

## Overview

The document management system provides a complete solution for uploading, viewing, processing, and managing legal documents with advanced features including:

- **Multi-format document viewing** (PDF, images, text files)
- **OCR processing** with real-time status tracking
- **Semantic search** and entity extraction
- **Document annotations** and collaborative notes
- **Privacy-first design** with automatic PII redaction
- **Accessibility compliance** (WCAG 2.2 AA)
- **Responsive design** for all devices

## Components

### 1. DocumentViewer
The main document viewing component with advanced features.

```tsx
import { DocumentViewer } from '@/components/documents';

<DocumentViewer
  documentId="doc-123"
  documentName="Contract Agreement.pdf"
  documentType="application/pdf"
  caseId="case-456"
  onClose={() => setShowViewer(false)}
  readOnly={false}
/>
```

**Features:**
- Multi-tab interface (Document, Text, Entities, Notes)
- Zoom, rotate, and fullscreen controls
- Real-time OCR processing with progress indicators
- Interactive annotations and notes system
- Print, download, and share functionality
- Keyboard navigation support

### 2. DocumentList
Searchable and filterable list of documents with advanced controls.

```tsx
import { DocumentList } from '@/components/documents';

<DocumentList
  caseId="case-123"
  onDocumentSelect={(doc) => setSelectedDoc(doc)}
  onDocumentUpload={() => setShowUpload(true)}
  allowDelete={true}
  compact={false}
  showCaseInfo={true}
/>
```

**Features:**
- Advanced search with full-text and metadata filtering
- Sort by name, date, size, type
- Document type and OCR status filtering
- Bulk operations support
- Drag-and-drop file upload
- Accessibility-compliant list navigation

### 3. DocumentUpload
Drag-and-drop file upload with OCR processing and metadata capture.

```tsx
import { DocumentUpload } from '@/components/documents';

<DocumentUpload
  caseId="case-123"
  onUploadComplete={(docs) => handleUpload(docs)}
  maxFiles={10}
  maxFileSize={10 * 1024 * 1024}
  autoOCR={true}
  showMetadataForm={true}
/>
```

**Features:**
- Drag-and-drop interface with visual feedback
- Multiple file upload with progress tracking
- Automatic document type detection
- Real-time OCR processing with progress
- Metadata form for document categorization
- File validation and error handling

### 4. DocumentMetadata
Comprehensive document metadata viewer and editor.

```tsx
import { DocumentMetadata } from '@/components/documents';

<DocumentMetadata
  documentId="doc-123"
  onUpdate={(metadata) => handleUpdate(metadata)}
  readOnly={false}
  compact={false}
/>
```

**Features:**
- Four-tab interface (General, Content, Privacy, Activity)
- Inline editing for document properties
- Tag management system
- OCR text and entity display
- Privacy and security information
- Access log and audit trail

### 5. DocumentManager
Complete document management interface combining all components.

```tsx
import { DocumentManager } from '@/components/documents';

<DocumentManager
  caseId="case-123"
  allowUpload={true}
  allowDelete={false}
  showCaseInfo={true}
  defaultView="list"
  height="calc(100vh - 200px)"
/>
```

**Features:**
- Split-panel layout with resizable sections
- Integrated upload, list, and viewer components
- Multiple layout modes (split, viewer-only, list-only)
- Responsive design with mobile support
- Status bar with document count and selection info

## Custom Hooks

### useDocuments
Hook for managing document lists and CRUD operations.

```tsx
import { useDocuments } from '@/components/documents/hooks';

const {
  documents,
  loading,
  error,
  loadDocuments,
  addDocument,
  updateDocument,
  removeDocument
} = useDocuments(caseId);
```

### useDocumentMetadata
Hook for managing individual document metadata.

```tsx
import { useDocumentMetadata } from '@/components/documents/hooks';

const {
  metadata,
  loading,
  error,
  loadMetadata,
  updateMetadata
} = useDocumentMetadata(documentId);
```

### useDocumentUpload
Hook for managing file uploads with progress tracking.

```tsx
import { useDocumentUpload } from '@/components/documents/hooks';

const {
  files,
  isUploading,
  error,
  addFiles,
  uploadFiles,
  canUpload,
  allCompleted
} = useDocumentUpload();
```

### useOCRStatus
Hook for monitoring OCR processing status.

```tsx
import { useOCRStatus } from '@/components/documents/hooks';

const {
  status,
  progress,
  text,
  entities,
  startOCRProcessing,
  isProcessing
} = useOCRStatus(documentId);
```

## API Endpoints

The document system requires the following server endpoints:

### Document Management
- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get single document
- `GET /api/documents/:id/metadata` - Get document metadata
- `PATCH /api/documents/:id/metadata` - Update document metadata
- `DELETE /api/documents/:id` - Delete document

### Document Viewing
- `GET /api/documents/:id/view` - Get document for viewing
- `GET /api/documents/:id/download` - Download document

### OCR Processing
- `GET /api/documents/:id/ocr-status` - Get OCR processing status
- `POST /api/documents/:id/ocr` - Start OCR processing

### Annotations
- `POST /api/documents/:id/annotations` - Add document annotation
- `GET /api/documents/:id/annotations` - Get document annotations

### Upload
- `POST /api/upload/document` - Upload single document
- `POST /api/upload/documents` - Upload multiple documents

## Types and Interfaces

### Core Types
```typescript
interface Document {
  id: string;
  name: string;
  type: string;
  source: string;
  size: number;
  uploadedAt: string;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  caseId: string;
  // ... additional fields
}

interface DocumentAnnotation {
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

interface DocumentEntity {
  type: string;
  value: string;
  confidence: number;
  page: number;
  position?: { x: number; y: number; width: number; height: number };
}
```

## Privacy and Security

### PII Redaction
- Automatic detection and redaction of personal information
- Configurable redaction levels and patterns
- Audit logging of all redaction activities

### Data Protection
- Encryption at rest and in transit
- Local processing to prevent data leakage
- Granular access controls and permissions

### Consent Management
- Explicit consent for OCR processing
- Revocable consent with data deletion
- Audit trail of all consent activities

## Accessibility Features

### WCAG 2.2 AA Compliance
- Full keyboard navigation support
- Screen reader optimization
- High contrast mode support
- Adjustable text sizes and zoom

### Trauma-Informed Design
- Clear, non-judgmental language
- User control over all actions
- Consent gates for sensitive operations
- Progress indicators for long operations

## Styling and Theming

The components use the existing shadcn/ui design system with:
- Consistent spacing and typography
- Responsive breakpoints
- Dark/light mode support
- Customizable color schemes

## Performance Considerations

### Optimization Features
- Lazy loading for large document lists
- Virtual scrolling for performance
- Image optimization and caching
- Background OCR processing

### Memory Management
- Efficient document viewer with canvas optimization
- Progress cleanup for completed uploads
- Automatic cleanup of temporary data

## Error Handling

### Comprehensive Error States
- Network error recovery with retry mechanisms
- File upload error handling with clear messages
- OCR processing failure notifications
- Graceful degradation for missing features

### User Feedback
- Loading states for all async operations
- Progress indicators for long-running tasks
- Success/error toast notifications
- Detailed error messages with actionable steps

## Browser Support

- **Modern browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile browsers:** iOS Safari 14+, Chrome Mobile 90+
- **Accessibility tools:** Screen readers, keyboard navigation

## Development Setup

### Prerequisites
```bash
# Required dependencies (already in package.json)
npm install @tanstack/react-query
npm install wouter
npm install lucide-react
npm install @hookform/resolvers
npm install zod
```

### Environment Variables
```env
# OCR Processing
ENABLE_AI_FEATURES=true
OLLAMA_URL=http://localhost:11434

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
MAX_FILES_PER_UPLOAD=10
ALLOWED_FILE_TYPES=.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif

# Privacy Settings
AUTO_PII_REDACTION=true
OCR_CONSENT_REQUIRED=true
RETENTION_PERIOD_DAYS=2555  # 7 years for legal documents
```

## Testing

### Component Testing
```bash
# Run component tests
npm test -- --testPathPattern=documents

# Test coverage
npm run test:coverage -- --collectCoverageFrom="src/components/documents/**"
```

### E2E Testing
```bash
# Run document workflow tests
npm run e2e -- --grep "document"

# Test accessibility
npm run test:a11y -- --component=DocumentViewer
```

## Integration Examples

### Basic Document Viewer
```tsx
import { useState } from 'react';
import { DocumentViewer } from '@/components/documents';

export function CaseDocuments({ caseId }: { caseId: string }) {
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  
  return (
    <div className="h-full">
      {selectedDoc ? (
        <DocumentViewer
          documentId={selectedDoc}
          caseId={caseId}
          onClose={() => setSelectedDoc(null)}
        />
      ) : (
        <div>Select a document to view</div>
      )}
    </div>
  );
}
```

### Complete Document Management
```tsx
import { DocumentManager } from '@/components/documents';

export function DocumentWorkspace({ caseId }: { caseId: string }) {
  return (
    <DocumentManager
      caseId={caseId}
      allowUpload={true}
      allowDelete={true}
      showCaseInfo={false}
      height="100vh"
    />
  );
}
```

### Custom Upload Integration
```tsx
import { useState } from 'react';
import { DocumentUpload } from '@/components/documents';
import { useDocumentUpload } from '@/components/documents/hooks';

export function CustomUploader({ caseId }: { caseId: string }) {
  const { files, uploadFiles, canUpload } = useDocumentUpload();
  
  const handleUpload = async () => {
    await uploadFiles(caseId, {
      source: 'email',
      enableOCR: true,
      priority: 'high'
    });
  };
  
  return (
    <DocumentUpload
      caseId={caseId}
      onUploadComplete={(docs) => console.log('Uploaded:', docs)}
      autoOCR={true}
    />
  );
}
```

## Contributing

### Code Style
- Follow existing TypeScript patterns
- Use functional components with hooks
- Implement proper error boundaries
- Add comprehensive prop validation

### Testing Requirements
- Unit tests for all components
- Integration tests for workflows
- Accessibility tests for all interactive elements
- Performance tests for large document sets

### Documentation
- Update README for new features
- Add JSDoc comments for all public APIs
- Include usage examples for complex components
- Document breaking changes in CHANGELOG

## Future Enhancements

### Planned Features
- Real-time collaborative annotations
- Advanced document comparison
- AI-powered document summarization
- Integration with external legal databases
- Mobile app companion

### Technical Improvements
- WebAssembly for OCR processing
- Progressive Web App features
- Enhanced accessibility features
- Advanced caching strategies

---

For questions or support, please refer to the main project documentation or open an issue in the repository.