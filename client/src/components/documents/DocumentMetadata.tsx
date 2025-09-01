import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FileText,
  Calendar,
  User,
  Hash,
  HardDrive,
  Eye,
  Edit3,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Search,
  Tag,
  FileType,
  Download,
  Share2
} from 'lucide-react';

interface DocumentMetadata {
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
  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
    page: number;
  }>;
  
  // Annotations
  annotations?: Array<{
    id: string;
    type: 'note' | 'highlight' | 'redaction';
    content: string;
    author: string;
    createdAt: string;
    page: number;
  }>;
  
  // Privacy & Security
  containsPII?: boolean;
  confidentialityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  encryptionStatus?: 'none' | 'at-rest' | 'full';
  accessLog?: Array<{
    action: string;
    user: string;
    timestamp: string;
    ipAddress?: string;
  }>;
}

interface DocumentMetadataProps {
  documentId: string;
  onUpdate?: (metadata: DocumentMetadata) => void;
  onClose?: () => void;
  readOnly?: boolean;
  compact?: boolean;
}

const DOCUMENT_TYPES = [
  'contract', 'correspondence', 'evidence', 'court-filing', 
  'invoice', 'statement', 'report', 'photo', 'other'
];

const CONFIDENTIALITY_LEVELS = [
  { value: 'public', label: 'Public', description: 'No restrictions' },
  { value: 'internal', label: 'Internal', description: 'Internal use only' },
  { value: 'confidential', label: 'Confidential', description: 'Restricted access' },
  { value: 'restricted', label: 'Restricted', description: 'Highly sensitive' }
];

export const DocumentMetadata: React.FC<DocumentMetadataProps> = ({
  documentId,
  onUpdate,
  onClose,
  readOnly = false,
  compact = false
}) => {
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DocumentMetadata>>({});
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    loadMetadata();
  }, [documentId]);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/documents/${documentId}/metadata`);
      if (!response.ok) {
        throw new Error(`Failed to load metadata: ${response.status}`);
      }
      
      const data = await response.json();
      setMetadata(data);
      setEditForm(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    if (!editForm || !metadata) return;
    
    try {
      setSaving(true);
      
      const response = await fetch(`/api/documents/${documentId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          type: editForm.type,
          description: editForm.description,
          tags: editForm.tags,
          priority: editForm.priority,
          confidentialityLevel: editForm.confidentialityLevel
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save changes');
      }
      
      const updatedMetadata = await response.json();
      setMetadata(updatedMetadata);
      setIsEditing(false);
      onUpdate?.(updatedMetadata);
      setSaving(false);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const addTag = () => {
    if (!newTag.trim() || !editForm.tags) return;
    
    const tags = [...editForm.tags, newTag.trim()];
    setEditForm(prev => ({ ...prev, tags }));
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    if (!editForm.tags) return;
    
    const tags = editForm.tags.filter(tag => tag !== tagToRemove);
    setEditForm(prev => ({ ...prev, tags }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getOCRStatusBadge = () => {
    if (!metadata) return null;
    
    const config = {
      pending: { variant: 'secondary' as const, icon: Clock, label: 'Pending' },
      processing: { variant: 'default' as const, icon: Zap, label: 'Processing' },
      completed: { variant: 'secondary' as const, icon: CheckCircle, label: 'Complete' },
      failed: { variant: 'destructive' as const, icon: AlertCircle, label: 'Failed' }
    };
    
    const { variant, icon: Icon, label } = config[metadata.ocrStatus];
    return (
      <Badge variant={variant} className="text-xs">
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const getConfidentialityBadge = () => {
    if (!metadata?.confidentialityLevel) return null;
    
    const config = {
      public: { variant: 'secondary' as const, label: 'Public' },
      internal: { variant: 'default' as const, label: 'Internal' },
      confidential: { variant: 'secondary' as const, label: 'Confidential' },
      restricted: { variant: 'destructive' as const, label: 'Restricted' }
    };
    
    const { variant, label } = config[metadata.confidentialityLevel];
    return <Badge variant={variant} className="text-xs">{label}</Badge>;
  };

  if (loading) {
    return (
      <Card className={`${compact ? 'h-full' : 'w-full max-w-2xl'}`}>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading metadata...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metadata) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Failed to load document metadata'}
          <Button variant="outline" size="sm" onClick={loadMetadata} className="ml-2">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={`${compact ? 'h-full' : 'w-full max-w-2xl'} flex flex-col`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Details
            {getOCRStatusBadge()}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (isEditing) {
                    saveChanges();
                  } else {
                    setIsEditing(true);
                  }
                }}
                disabled={saving}
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : isEditing ? (
                  <Save className="h-4 w-4 mr-2" />
                ) : (
                  <Edit3 className="h-4 w-4 mr-2" />
                )}
                {saving ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <Tabs defaultValue="general" className="h-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {/* Basic Information */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="filename">Filename</Label>
                      {isEditing ? (
                        <Input
                          id="filename"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-medium py-2">{metadata.name}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="type">Document Type</Label>
                      {isEditing ? (
                        <Select 
                          value={editForm.type} 
                          onValueChange={(value) => setEditForm(prev => ({ ...prev, type: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map(type => (
                              <SelectItem key={type} value={type}>
                                {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm py-2 capitalize">{metadata.type.replace('-', ' ')}</p>
                      )}
                    </div>
                  </div>

                  {metadata.originalName && metadata.originalName !== metadata.name && (
                    <div>
                      <Label>Original Filename</Label>
                      <p className="text-sm text-muted-foreground py-2">{metadata.originalName}</p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="description">Description</Label>
                    {isEditing ? (
                      <Textarea
                        id="description"
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Add a description..."
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm py-2 text-muted-foreground">
                        {metadata.description || 'No description provided'}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      {isEditing ? (
                        <Select 
                          value={editForm.priority || 'normal'} 
                          onValueChange={(value) => setEditForm(prev => ({ ...prev, priority: value as any }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={metadata.priority === 'high' ? 'destructive' : metadata.priority === 'low' ? 'secondary' : 'default'} className="mt-2">
                          {metadata.priority || 'Normal'}
                        </Badge>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="confidentiality">Confidentiality</Label>
                      {isEditing ? (
                        <Select 
                          value={editForm.confidentialityLevel || 'internal'} 
                          onValueChange={(value) => setEditForm(prev => ({ ...prev, confidentialityLevel: value as any }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONFIDENTIALITY_LEVELS.map(level => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        getConfidentialityBadge()
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Tags */}
                <div>
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2 mb-2">
                    {(isEditing ? editForm.tags : metadata.tags)?.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                        {isEditing && (
                          <button 
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                          >
                            <X className="h-2 w-2" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                  {isEditing && (
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add tag..."
                        className="flex-1"
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      />
                      <Button onClick={addTag} disabled={!newTag.trim()} size="sm">
                        Add
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* File Information */}
                <div className="space-y-2">
                  <h4 className="font-medium">File Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Size:</span>
                      <span className="ml-2">{formatFileSize(metadata.size)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Source:</span>
                      <span className="ml-2 capitalize">{metadata.source}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Uploaded:</span>
                      <span className="ml-2">{formatDate(metadata.uploadedAt)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Modified:</span>
                      <span className="ml-2">{formatDate(metadata.updatedAt)}</span>
                    </div>
                    {metadata.uploadedBy && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Uploaded by:</span>
                        <span className="ml-2">{metadata.uploadedBy}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Case Information */}
                {metadata.caseName && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium">Case Information</h4>
                      <p className="text-sm text-muted-foreground">{metadata.caseName}</p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="content" className="mt-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {/* OCR Information */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">OCR Processing</h4>
                    {getOCRStatusBadge()}
                  </div>
                  
                  {metadata.ocrProcessedAt && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Processed: {formatDate(metadata.ocrProcessedAt)}
                    </p>
                  )}
                  
                  {metadata.ocrText && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {metadata.ocrText.substring(0, 500)}
                        {metadata.ocrText.length > 500 && '...'}
                      </p>
                      {metadata.wordCount && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {metadata.wordCount} words extracted
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Document Analysis */}
                <div>
                  <h4 className="font-medium mb-2">Document Analysis</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {metadata.pageCount && (
                      <div>
                        <span className="text-muted-foreground">Pages:</span>
                        <span className="ml-2">{metadata.pageCount}</span>
                      </div>
                    )}
                    {metadata.wordCount && (
                      <div>
                        <span className="text-muted-foreground">Words:</span>
                        <span className="ml-2">{metadata.wordCount.toLocaleString()}</span>
                      </div>
                    )}
                    {metadata.entities && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Entities:</span>
                        <span className="ml-2">{metadata.entities.length} identified</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extracted Entities */}
                {metadata.entities && metadata.entities.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Extracted Entities</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {metadata.entities.slice(0, 10).map((entity, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div>
                              <Badge variant="outline" className="text-xs mr-2">
                                {entity.type}
                              </Badge>
                              <span className="text-sm">{entity.value}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(entity.confidence * 100).toFixed(0)}% • Page {entity.page}
                            </div>
                          </div>
                        ))}
                        {metadata.entities.length > 10 && (
                          <p className="text-xs text-muted-foreground">
                            And {metadata.entities.length - 10} more entities...
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Annotations */}
                {metadata.annotations && metadata.annotations.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">
                        Annotations ({metadata.annotations.length})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {metadata.annotations.slice(0, 5).map((annotation) => (
                          <div key={annotation.id} className="p-2 bg-gray-50 rounded">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline" className="text-xs">
                                {annotation.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {annotation.author} • Page {annotation.page}
                              </span>
                            </div>
                            <p className="text-sm">{annotation.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(annotation.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="privacy" className="mt-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Privacy & Security</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Contains PII:</span>
                      <Badge variant={metadata.containsPII ? 'destructive' : 'secondary'} className="ml-2">
                        {metadata.containsPII ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Encryption:</span>
                      <Badge variant="outline" className="ml-2 capitalize">
                        {metadata.encryptionStatus || 'None'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">File Integrity</h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">SHA-256 Hash</span>
                    </div>
                    <p className="text-xs font-mono break-all">{metadata.hash}</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {metadata.accessLog && metadata.accessLog.length > 0 ? (
                  <div>
                    <h4 className="font-medium mb-2">Access Log</h4>
                    <div className="space-y-2">
                      {metadata.accessLog.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <span className="text-sm font-medium capitalize">{entry.action}</span>
                            <span className="text-sm text-muted-foreground ml-2">by {entry.user}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(entry.timestamp)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No activity logged</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};