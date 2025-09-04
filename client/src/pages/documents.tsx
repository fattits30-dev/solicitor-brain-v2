import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileImage,
  FileText,
  FileType,
  Grid3X3,
  List,
  Loader2,
  MoreVertical,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { DocumentUpload, DocumentViewer } from '@/components/documents';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Case } from '@shared/schema';

interface Document {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  hash: string;
  uploadedById: number;
  extractedText: string | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  caseId: number;
  case?: {
    id: number;
    title: string;
    caseReference: string;
  };
  uploadedBy?: {
    id: number;
    name: string;
    email: string;
  };
  ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  pageCount?: number;
}

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'date' | 'size' | 'type' | 'case';
type SortOrder = 'asc' | 'desc';

export default function DocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('all');
  const [selectedFileType, setSelectedFileType] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Query for documents
  const {
    data: documents = [],
    isLoading: documentsLoading,
    error: documentsError,
    refetch: refetchDocuments,
  } = useQuery<Document[]>({
    queryKey: ['/api/search/documents', selectedCaseId, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCaseId !== 'all') params.append('caseId', selectedCaseId);
      if (searchQuery) params.append('q', searchQuery);

      const response = await fetch(`/api/search/documents?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      return data.documents || [];
    },
  });

  // Query for cases (for filtering)
  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
    queryFn: async () => {
      const response = await fetch('/api/cases', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }

      return response.json();
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/upload/document/${documentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Document deleted',
        description: 'The document has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/search/documents'] });
      setSelectedDocument(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete document.',
        variant: 'destructive',
      });
    },
  });

  // Filter and sort documents
  const filteredAndSortedDocuments = useCallback(() => {
    let filtered = documents;

    // Filter by file type
    if (selectedFileType !== 'all') {
      filtered = filtered.filter((doc) => {
        if (selectedFileType === 'pdf') return doc.mimeType === 'application/pdf';
        if (selectedFileType === 'image') return doc.mimeType?.startsWith('image/');
        if (selectedFileType === 'text') return doc.mimeType?.startsWith('text/');
        return true;
      });
    }

    // Sort documents
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'name':
          aValue = a.fileName.toLowerCase();
          bValue = b.fileName.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'size':
          aValue = a.fileSize;
          bValue = b.fileSize;
          break;
        case 'type':
          aValue = a.mimeType || '';
          bValue = b.mimeType || '';
          break;
        case 'case':
          aValue = a.case?.title || '';
          bValue = b.case?.title || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [documents, selectedFileType, sortField, sortOrder]);

  const handleDocumentSelect = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleDeleteDocument = (documentId: string) => {
    if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      deleteMutation.mutate(documentId);
    }
  };

  const handleUploadComplete = (uploadedDocuments: any[]) => {
    toast({
      title: 'Upload complete',
      description: `${uploadedDocuments.length} document(s) uploaded successfully.`,
    });
    setShowUploadDialog(false);
    refetchDocuments();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    if (mimeType?.startsWith('image/')) return <FileImage className="h-8 w-8 text-blue-500" />;
    return <FileType className="h-8 w-8 text-gray-500" />;
  };

  const getOcrStatusBadge = (status?: string, hasText?: boolean) => {
    if (!status && !hasText) return null;

    if (hasText) {
      return (
        <Badge variant="secondary" className="text-green-600 bg-green-50">
          OCR Complete
        </Badge>
      );
    }

    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="text-yellow-600 bg-yellow-50">
            <Clock className="h-3 w-3 mr-1" />
            Pending OCR
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary" className="text-blue-600 bg-blue-50">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            OCR Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const DocumentCard = ({ document }: { document: Document }) => (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => handleDocumentSelect(document)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {getFileIcon(document.mimeType)}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate" title={document.fileName}>
                {document.fileName}
              </h3>
              <div className="space-y-1 mt-2">
                {document.case && (
                  <Badge variant="outline" className="text-xs">
                    {document.case.title}
                  </Badge>
                )}
                {getOcrStatusBadge(document.ocrStatus, !!document.extractedText)}
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(document.fileSize)}</span>
                  <span>•</span>
                  <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                </div>
                {document.uploadedBy && (
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{document.uploadedBy.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleDocumentSelect(document);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/api/upload/document/${document.id}/download`, '_blank');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              {(user?.role === 'admin' || document.uploadedById.toString() === user?.id) && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDocument(document.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );

  const DocumentListItem = ({ document }: { document: Document }) => (
    <div
      className="flex items-center p-4 hover:bg-muted/50 border-b cursor-pointer transition-colors"
      onClick={() => handleDocumentSelect(document)}
    >
      <div className="flex items-center space-x-4 flex-1">
        {getFileIcon(document.mimeType)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-medium truncate" title={document.fileName}>
              {document.fileName}
            </h3>
            <div className="flex items-center space-x-2">
              {document.case && (
                <Badge variant="outline" className="text-xs">
                  {document.case.title}
                </Badge>
              )}
              {getOcrStatusBadge(document.ocrStatus, !!document.extractedText)}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>{formatFileSize(document.fileSize)}</span>
              <span>•</span>
              <span>{new Date(document.createdAt).toLocaleDateString()}</span>
              {document.uploadedBy && (
                <>
                  <span>•</span>
                  <span>{document.uploadedBy.name}</span>
                </>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDocumentSelect(document);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/api/upload/document/${document.id}/download`, '_blank');
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
                {(user?.role === 'admin' || document.uploadedById.toString() === user?.id) && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(document.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Document Management"
          subtitle="Manage legal documents with AI-powered OCR and search capabilities"
        />
        <div className="flex-1 overflow-hidden">
          {selectedDocument ? (
            // Document Viewer View
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b bg-muted/20">
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDocument(null)}>
                    <X className="h-4 w-4" />
                    Close
                  </Button>
                  <div className="h-4 w-px bg-border" />
                  <h2 className="font-semibold">{selectedDocument.fileName}</h2>
                  {selectedDocument.case && (
                    <Badge variant="outline">{selectedDocument.case.title}</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/upload/document/${selectedDocument.id}/download`} download>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <DocumentViewer
                  documentId={selectedDocument.id}
                  documentUrl={`/api/upload/document/${selectedDocument.id}/download`}
                  documentName={selectedDocument.fileName}
                  documentType={selectedDocument.mimeType}
                  caseId={selectedDocument.caseId?.toString()}
                  readOnly={
                    !(
                      user?.role === 'admin' ||
                      selectedDocument.uploadedById.toString() === user?.id
                    )
                  }
                />
              </div>
            </div>
          ) : (
            // Document List/Grid View
            <div className="h-full flex flex-col p-6 space-y-6">
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Filters */}
                  <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by case" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cases</SelectItem>
                      {cases.map((case_) => (
                        <SelectItem key={case_.id} value={case_.id.toString()}>
                          {case_.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedFileType} onValueChange={setSelectedFileType}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="image">Images</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Sort */}
                  <Select
                    value={`${sortField}-${sortOrder}`}
                    onValueChange={(value) => {
                      const [field, order] = value.split('-') as [SortField, SortOrder];
                      setSortField(field);
                      setSortOrder(order);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name-asc">Name A-Z</SelectItem>
                      <SelectItem value="name-desc">Name Z-A</SelectItem>
                      <SelectItem value="date-desc">Newest First</SelectItem>
                      <SelectItem value="date-asc">Oldest First</SelectItem>
                      <SelectItem value="size-desc">Largest First</SelectItem>
                      <SelectItem value="size-asc">Smallest First</SelectItem>
                      <SelectItem value="type-asc">Type A-Z</SelectItem>
                      <SelectItem value="case-asc">Case A-Z</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Mode Toggle */}
                  <div className="flex border rounded-lg">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Upload Button */}
                  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Upload Documents</DialogTitle>
                        <DialogDescription>
                          Upload one or more documents to the system. OCR processing will begin
                          automatically.
                        </DialogDescription>
                      </DialogHeader>
                      <DocumentUpload
                        onUploadComplete={handleUploadComplete}
                        maxFiles={10}
                        maxFileSize={50 * 1024 * 1024} // 50MB
                        allowedTypes={['application/pdf', 'image/*', 'text/*']}
                        autoOCR={true}
                        showMetadataForm={true}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Document Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Total Documents</span>
                    </div>
                    <div className="text-2xl font-bold mt-2">{documents.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">OCR Processed</span>
                    </div>
                    <div className="text-2xl font-bold mt-2">
                      {documents.filter((d) => d.extractedText).length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Processing</span>
                    </div>
                    <div className="text-2xl font-bold mt-2">
                      {
                        documents.filter(
                          (d) => d.ocrStatus === 'processing' || d.ocrStatus === 'pending',
                        ).length
                      }
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Failed</span>
                    </div>
                    <div className="text-2xl font-bold mt-2">
                      {documents.filter((d) => d.ocrStatus === 'failed').length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Error State */}
              {documentsError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Failed to load documents. Please try again.</AlertDescription>
                </Alert>
              )}

              {/* Loading State */}
              {documentsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading documents...</span>
                </div>
              )}

              {/* Document Grid/List */}
              {!documentsLoading && !documentsError && (
                <div className="flex-1 overflow-hidden">
                  {filteredAndSortedDocuments().length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No documents found</h3>
                      <p className="text-muted-foreground mb-4">
                        {searchQuery || selectedCaseId !== 'all' || selectedFileType !== 'all'
                          ? 'Try adjusting your search or filter criteria.'
                          : 'Upload your first document to get started.'}
                      </p>
                      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                        <DialogTrigger asChild>
                          <Button>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Document
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-auto">
                      {filteredAndSortedDocuments().map((document) => (
                        <DocumentCard key={document.id} document={document} />
                      ))}
                    </div>
                  ) : (
                    <Card className="overflow-hidden">
                      <div className="divide-y">
                        {filteredAndSortedDocuments().map((document) => (
                          <DocumentListItem key={document.id} document={document} />
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
