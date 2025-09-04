import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Calendar,
  Download,
  Eye,
  FileImage,
  FileText,
  FileType,
  Loader2,
  MoreVertical,
  RefreshCw,
  SortAsc,
  SortDesc,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

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

interface DocumentListProps {
  caseId?: string;
  onDocumentSelect?: (document: Document) => void;
  onDocumentUpload?: () => void;
  selectedDocumentId?: string;
  allowDelete?: boolean;
  compact?: boolean;
  showCaseInfo?: boolean;
}

type SortField = 'name' | 'uploadedAt' | 'size' | 'type';
type SortDirection = 'asc' | 'desc';

const DOCUMENT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'pdf', label: 'PDF Documents' },
  { value: 'image', label: 'Images' },
  { value: 'text', label: 'Text Files' },
  { value: 'contract', label: 'Contracts' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'court-filing', label: 'Court Filings' },
];

const OCR_STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending OCR' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'OCR Complete' },
  { value: 'failed', label: 'OCR Failed' },
];

export const DocumentList: React.FC<DocumentListProps> = ({
  caseId,
  onDocumentSelect,
  onDocumentUpload,
  selectedDocumentId,
  allowDelete = false,
  compact = false,
  showCaseInfo = true,
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('uploadedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; documentId: string | null }>({
    open: false,
    documentId: null,
  });

  useEffect(() => {
    loadDocuments();
  }, [caseId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = caseId ? `/api/cases/${caseId}/documents` : '/api/documents';
      
      // Get auth token
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to load documents: ${response.status}`);
      }

      const data = await response.json();
      setDocuments(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.name.toLowerCase().includes(query) ||
          doc.type.toLowerCase().includes(query) ||
          doc.ocrText?.toLowerCase().includes(query) ||
          doc.caseName?.toLowerCase().includes(query),
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((doc) => doc.type.includes(typeFilter));
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((doc) => doc.ocrStatus === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'uploadedAt':
          aValue = new Date(a.uploadedAt);
          bValue = new Date(b.uploadedAt);
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'type':
          aValue = a.type.toLowerCase();
          bValue = b.type.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [documents, searchQuery, typeFilter, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      setDeleteDialog({ open: false, documentId: null });
    } catch {
      setError('Failed to delete document');
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const response = await fetch(`/api/documents/${document.id}/download`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.name;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-4 w-4" />;
    if (type.includes('image')) return <FileImage className="h-4 w-4" />;
    return <FileType className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { variant: 'secondary' as const, label: 'Pending' },
      processing: { variant: 'default' as const, label: 'Processing' },
      completed: { variant: 'outline' as const, label: 'Complete' },
      failed: { variant: 'destructive' as const, label: 'Failed' },
    };

    const { variant, label } = config[status as keyof typeof config] || config.pending;
    return (
      <Badge variant={variant} className="text-xs">
        {label}
      </Badge>
    );
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <SortAsc className="h-4 w-4 ml-1" />
    ) : (
      <SortDesc className="h-4 w-4 ml-1" />
    );
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading documents...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" onClick={loadDocuments} className="ml-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className={compact ? 'pb-3' : 'pb-4'}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents
              <Badge variant="secondary">{filteredAndSortedDocuments.length}</Badge>
            </CardTitle>

            {onDocumentUpload && (
              <Button onClick={onDocumentUpload} size={compact ? 'sm' : 'default'}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="grid gap-3 mt-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                }}
                title="Clear filters"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OCR_STATUS_FILTERS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Sort by:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('name')}
                className="h-6 px-2"
              >
                Name {getSortIcon('name')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('uploadedAt')}
                className="h-6 px-2"
              >
                Date {getSortIcon('uploadedAt')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('size')}
                className="h-6 px-2"
              >
                Size {getSortIcon('size')}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            {filteredAndSortedDocuments.length === 0 ? (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">
                    {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                      ? 'No documents match your filters'
                      : 'No documents found'}
                  </p>
                  {onDocumentUpload && (
                    <Button onClick={onDocumentUpload} variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload First Document
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredAndSortedDocuments.map((document) => (
                  <Card
                    key={document.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedDocumentId === document.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => onDocumentSelect?.(document)}
                  >
                    <CardContent className={`p-4 ${compact ? 'py-3' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 mt-0.5">{getFileIcon(document.type)}</div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate" title={document.name}>
                                {document.name}
                              </h4>
                              {getStatusBadge(document.ocrStatus)}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-1">
                              <span className="capitalize">{document.type}</span>
                              <span>{formatFileSize(document.size)}</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(document.uploadedAt).toLocaleDateString()}
                              </span>
                            </div>

                            {showCaseInfo && document.caseName && (
                              <p className="text-xs text-muted-foreground truncate">
                                Case: {document.caseName}
                              </p>
                            )}

                            {document.uploadedBy && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {document.uploadedBy}
                              </p>
                            )}

                            {/* Document Stats */}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {document.pageCount && <span>{document.pageCount} pages</span>}
                              {document.entities && document.entities.length > 0 && (
                                <span>{document.entities.length} entities</span>
                              )}
                              {document.annotations && document.annotations > 0 && (
                                <span>{document.annotations} notes</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onDocumentSelect?.(document);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(document);
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            {allowDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteDialog({ open: true, documentId: document.id });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, documentId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone. All
              associated OCR text, entities, and annotations will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.documentId && handleDelete(deleteDialog.documentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
