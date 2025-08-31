import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Resizable } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentViewer } from './DocumentViewer';
import { DocumentList } from './DocumentList';
import { DocumentUpload } from './DocumentUpload';
import { DocumentMetadata } from './DocumentMetadata';
import {
  FileText,
  Upload,
  Search,
  Settings,
  Grid,
  List,
  Eye,
  Info,
  PanelLeftOpen,
  PanelRightOpen,
  Maximize,
  Minimize,
  RotateCcw
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: string;
  source: string;
  size: number;
  uploadedAt: string;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  caseId: string;
  caseName?: string;
  uploadedBy?: string;
  ocrText?: string;
  pageCount?: number;
  entities?: Array<{ type: string; value: string; confidence: number }>;
  annotations?: number;
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

type ViewMode = 'list' | 'grid';
type PanelLayout = 'split' | 'viewer-only' | 'list-only';

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  caseId,
  allowUpload = true,
  allowDelete = false,
  showCaseInfo = true,
  defaultView = 'list',
  compact = false,
  height = 'calc(100vh - 200px)'
}) => {
  // State management
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [panelLayout, setPanelLayout] = useState<PanelLayout>('split');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showMetadataSheet, setShowMetadataSheet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Panel sizes (for responsive layout)
  const [listPanelSize, setListPanelSize] = useState(40);
  const [viewerPanelSize, setViewerPanelSize] = useState(60);

  // Load documents on component mount
  useEffect(() => {
    if (caseId) {
      loadDocuments();
    }
  }, [caseId]);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const url = caseId ? `/api/cases/${caseId}/documents` : '/api/documents';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to load documents');
      }
      
      const data = await response.json();
      setDocuments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const handleDocumentSelect = useCallback((document: Document) => {
    setSelectedDocument(document);
    if (compact || window.innerWidth < 768) {
      setPanelLayout('viewer-only');
    }
  }, [compact]);

  const handleUploadComplete = useCallback((uploadedDocuments: any[]) => {
    setShowUploadDialog(false);
    loadDocuments(); // Refresh the document list
    
    // Auto-select first uploaded document
    if (uploadedDocuments.length > 0 && !compact) {
      setTimeout(() => {
        const firstDoc = documents.find(d => d.id === uploadedDocuments[0].id);
        if (firstDoc) {
          setSelectedDocument(firstDoc);
        }
      }, 1000);
    }
  }, [documents, compact, loadDocuments]);

  const handleMetadataUpdate = useCallback((metadata: any) => {
    // Update the document in the list
    setDocuments(prev => 
      prev.map(doc => doc.id === metadata.id ? { ...doc, ...metadata } : doc)
    );
    
    // Update selected document if it matches
    if (selectedDocument?.id === metadata.id) {
      setSelectedDocument(prev => prev ? { ...prev, ...metadata } : null);
    }
  }, [selectedDocument]);

  const togglePanelLayout = useCallback(() => {
    if (panelLayout === 'split') {
      setPanelLayout(selectedDocument ? 'viewer-only' : 'list-only');
    } else if (panelLayout === 'viewer-only') {
      setPanelLayout('list-only');
    } else {
      setPanelLayout('split');
    }
  }, [panelLayout, selectedDocument]);

  const resetLayout = useCallback(() => {
    setPanelLayout('split');
    setListPanelSize(40);
    setViewerPanelSize(60);
  }, []);

  // Responsive layout helpers
  const isFullScreen = panelLayout === 'viewer-only' || panelLayout === 'list-only';
  const showList = panelLayout !== 'viewer-only';
  const showViewer = panelLayout !== 'list-only' && selectedDocument;

  return (
    <div className="w-full" style={{ height }}>
      <Card className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">
                {caseId ? 'Case Documents' : 'All Documents'}
              </h2>
              <Badge variant="secondary" className="text-xs">
                {documents.length}
              </Badge>
            </div>

            {/* View Mode Toggle */}
            {showList && (
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-r-none"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-l-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Layout Controls */}
            <div className="flex items-center border rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePanelLayout}
                title="Toggle Panel Layout"
                className="px-2"
              >
                {panelLayout === 'split' && <PanelLeftOpen className="h-4 w-4" />}
                {panelLayout === 'list-only' && <List className="h-4 w-4" />}
                {panelLayout === 'viewer-only' && <Eye className="h-4 w-4" />}
              </Button>
              
              {panelLayout === 'split' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetLayout}
                  title="Reset Layout"
                  className="px-2 border-l"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Document Metadata */}
            {selectedDocument && (
              <Sheet open={showMetadataSheet} onOpenChange={setShowMetadataSheet}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Info className="h-4 w-4 mr-2" />
                    Details
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[600px] sm:max-w-[600px]">
                  <SheetHeader>
                    <SheetTitle>Document Details</SheetTitle>
                    <SheetDescription>
                      View and edit document metadata
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 h-full">
                    <DocumentMetadata
                      documentId={selectedDocument.id}
                      onUpdate={handleMetadataUpdate}
                      compact={true}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            )}

            {/* Upload Button */}
            {allowUpload && (
              <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <Button onClick={() => setShowUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>Upload Documents</DialogTitle>
                    <DialogDescription>
                      Upload documents for {caseId ? 'this case' : 'the system'}
                    </DialogDescription>
                  </DialogHeader>
                  <DocumentUpload
                    caseId={caseId}
                    onUploadComplete={handleUploadComplete}
                    onClose={() => setShowUploadDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {panelLayout === 'split' ? (
            // Split Layout with Resizable Panels
            <div className="flex h-full">
              <div 
                className="border-r overflow-hidden"
                style={{ width: `${listPanelSize}%` }}
              >
                <DocumentList
                  caseId={caseId}
                  onDocumentSelect={handleDocumentSelect}
                  selectedDocumentId={selectedDocument?.id}
                  allowDelete={allowDelete}
                  compact={true}
                  showCaseInfo={showCaseInfo}
                />
              </div>
              
              <div 
                className="flex-1 overflow-hidden"
                style={{ width: `${viewerPanelSize}%` }}
              >
                {selectedDocument ? (
                  <DocumentViewer
                    documentId={selectedDocument.id}
                    documentName={selectedDocument.name}
                    documentType={selectedDocument.type}
                    caseId={selectedDocument.caseId}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Select a document to view</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Single Panel Layout
            <div className="h-full">
              {showList && (
                <DocumentList
                  caseId={caseId}
                  onDocumentSelect={handleDocumentSelect}
                  onDocumentUpload={() => setShowUploadDialog(true)}
                  selectedDocumentId={selectedDocument?.id}
                  allowDelete={allowDelete}
                  compact={compact}
                  showCaseInfo={showCaseInfo}
                />
              )}
              
              {showViewer && selectedDocument && (
                <DocumentViewer
                  documentId={selectedDocument.id}
                  documentName={selectedDocument.name}
                  documentType={selectedDocument.type}
                  caseId={selectedDocument.caseId}
                  onClose={() => {
                    setSelectedDocument(null);
                    setPanelLayout('list-only');
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="px-4 py-2 border-t bg-gray-50 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>{documents.length} documents</span>
              {selectedDocument && (
                <span>Selected: {selectedDocument.name}</span>
              )}
              {loading && (
                <span className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                  Loading...
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {caseId && <span>Case: {caseId}</span>}
              <span>Layout: {panelLayout}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};