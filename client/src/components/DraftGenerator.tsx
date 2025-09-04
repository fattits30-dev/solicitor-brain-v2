import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Download,
  Copy,
  // Send,
  Save,
  Sparkles,
  AlertCircle,
  // CheckCircle,
  Edit,
  RotateCcw,
  FileSignature,
  Calendar,
  // User,
  Building,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { typedApiClient, ApiError } from '@/lib/typed-api-client';
import type { AiDraftRequest } from '../../../shared/api-types';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'date' | 'select';
    required?: boolean;
    options?: string[];
    placeholder?: string;
  }>;
}

interface DraftGeneratorProps {
  caseId?: string;
  initialContent?: string;
  onSave?: (draft: any) => void;
}

export const DraftGenerator: React.FC<DraftGeneratorProps> = ({
  caseId,
  initialContent,
  onSave,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('generate');

  // Load templates
  useEffect(() => {
    loadTemplates();
    if (caseId) {
      loadSavedDrafts();
    }
  }, [caseId]);

  useEffect(() => {
    if (initialContent) {
      setGeneratedDraft(initialContent);
      setEditMode(true);
      setActiveTab('preview');
    }
  }, [initialContent]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || mockTemplates);
      } else {
        // Use mock templates as fallback
        setTemplates(mockTemplates);
      }
    } catch {
      setTemplates(mockTemplates);
    }
  };

  const loadSavedDrafts = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}/drafts`);
      if (response.ok) {
        const data = await response.json();
        setSavedDrafts(data.drafts || []);
      }
    } catch (err) {
      console.error('Failed to load drafts:', err);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      // Initialize form data with empty values
      const initialData: Record<string, any> = {};
      template.fields.forEach((field) => {
        initialData[field.name] = '';
      });
      setFormData(initialData);
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    setError(null);

    try {
      const draftRequest: AiDraftRequest = {
        template: selectedTemplate.name,
        data: {
          templateId: selectedTemplate.id,
          ...formData,
          caseId,
        },
        options: {
          tone: 'formal',
          length: 'medium',
        },
      };

      const response = await typedApiClient.generateDraft(draftRequest);
      setGeneratedDraft(response.content);
      setActiveTab('preview');
      
      console.log('Draft generated with metadata:', response.metadata);
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.isValidationError() 
          ? `Validation Error: ${err.getValidationErrors().join(', ')}`
          : err.message
        : (err as Error).message;
      
      setError(errorMessage);
      // Generate a mock draft as fallback
      generateMockDraft();
    } finally {
      setLoading(false);
    }
  };

  const generateMockDraft = () => {
    if (!selectedTemplate) return;

    let content = `[${selectedTemplate.name}]\n\n`;
    content += `Date: ${new Date().toLocaleDateString()}\n\n`;

    selectedTemplate.fields.forEach((field) => {
      const value = formData[field.name] || `[${field.label}]`;
      content += `${field.label}: ${value}\n`;
    });

    content += `\n\n[Generated content based on template and provided information]\n`;
    content += `\nYours sincerely,\n[Signature]`;

    setGeneratedDraft(content);
    setActiveTab('preview');
  };

  const handleSaveDraft = async () => {
    if (!generatedDraft) return;

    const draft = {
      id: Date.now().toString(),
      content: generatedDraft,
      templateId: selectedTemplate?.id,
      templateName: selectedTemplate?.name,
      caseId,
      createdAt: new Date().toISOString(),
      status: 'draft',
    };

    try {
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      if (response.ok) {
        setSavedDrafts((prev) => [draft, ...prev]);
        onSave?.(draft);
      }
    } catch (err) {
      console.error('Failed to save draft:', err);
    }

    // Always call onSave even if API fails
    onSave?.(draft);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedDraft], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate?.name || 'draft'}_${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDraft);
  };

  const handleReset = () => {
    setSelectedTemplate(null);
    setFormData({});
    setGeneratedDraft('');
    setEditMode(false);
    setActiveTab('generate');
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Draft Generator
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleReset} title="Reset">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generate">
              <Sparkles className="h-3 w-3 mr-1" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!generatedDraft}>
              <FileText className="h-3 w-3 mr-1" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="saved">
              <Save className="h-3 w-3 mr-1" />
              Saved ({savedDrafts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              {/* Template Selector */}
              <div>
                <Label htmlFor="template">Select Template</Label>
                <Select value={selectedTemplate?.id} onValueChange={handleTemplateSelect}>
                  <SelectTrigger id="template" className="mt-1">
                    <SelectValue placeholder="Choose a document template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          <span>{template.name}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {template.category}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedTemplate.description}
                  </p>
                )}
              </div>

              {/* Dynamic Form Fields */}
              {selectedTemplate && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Fill in the details:</h3>
                  {selectedTemplate.fields.map((field) => (
                    <div key={field.name}>
                      <Label htmlFor={field.name}>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          id={field.name}
                          value={formData[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className="mt-1"
                          rows={3}
                        />
                      ) : field.type === 'select' && field.options ? (
                        <Select
                          value={formData[field.name]}
                          onValueChange={(value) => handleFieldChange(field.name, value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={field.placeholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.type === 'date' ? (
                        <Input
                          id={field.name}
                          type="date"
                          value={formData[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          className="mt-1"
                        />
                      ) : (
                        <Input
                          id={field.name}
                          type="text"
                          value={formData[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className="mt-1"
                        />
                      )}
                    </div>
                  ))}

                  <Button
                    onClick={handleGenerate}
                    disabled={loading || !selectedTemplate}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Draft
                      </>
                    )}
                  </Button>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 flex flex-col gap-4 mt-4">
            {generatedDraft && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Generated Draft</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
                      <Edit className="h-3 w-3 mr-1" />
                      {editMode ? 'Preview' : 'Edit'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                    <Button size="sm" onClick={handleSaveDraft}>
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  {editMode ? (
                    <Textarea
                      value={generatedDraft}
                      onChange={(e) => setGeneratedDraft(e.target.value)}
                      className="h-full min-h-[400px] font-mono text-sm"
                    />
                  ) : (
                    <div className="bg-white p-6 rounded-lg border">
                      <pre className="whitespace-pre-wrap text-sm font-sans">{generatedDraft}</pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="saved" className="flex-1 overflow-auto mt-4">
            {savedDrafts.length > 0 ? (
              <div className="space-y-3">
                {savedDrafts.map((draft) => (
                  <Card key={draft.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium text-sm">
                            {draft.templateName || 'Untitled Draft'}
                          </h4>
                        </div>
                        <Badge variant="secondary">{draft.status || 'draft'}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {draft.content}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(draft.createdAt).toLocaleDateString()}
                        </span>
                        {draft.caseId && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            Case #{draft.caseId}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGeneratedDraft(draft.content);
                            setActiveTab('preview');
                          }}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(draft.content);
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32">
                <Save className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No saved drafts yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Mock templates for testing
const mockTemplates: Template[] = [
  {
    id: 'letter-response',
    name: 'Response Letter',
    category: 'Correspondence',
    description: 'Standard response letter template',
    fields: [
      { name: 'recipientName', label: 'Recipient Name', type: 'text', required: true },
      { name: 'recipientAddress', label: 'Recipient Address', type: 'textarea', required: true },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'mainContent', label: 'Main Content', type: 'textarea', required: true },
      { name: 'signatory', label: 'Signatory', type: 'text', required: true },
    ],
  },
  {
    id: 'witness-statement',
    name: 'Witness Statement',
    category: 'Legal',
    description: 'Template for witness statements',
    fields: [
      { name: 'witnessName', label: 'Witness Name', type: 'text', required: true },
      { name: 'dateOfIncident', label: 'Date of Incident', type: 'date', required: true },
      { name: 'location', label: 'Location', type: 'text', required: true },
      { name: 'statement', label: 'Statement', type: 'textarea', required: true },
      { name: 'signatureDate', label: 'Signature Date', type: 'date', required: true },
    ],
  },
  {
    id: 'court-application',
    name: 'Court Application',
    category: 'Legal',
    description: 'Template for court applications',
    fields: [
      { name: 'courtName', label: 'Court Name', type: 'text', required: true },
      { name: 'caseNumber', label: 'Case Number', type: 'text' },
      { name: 'applicantName', label: 'Applicant Name', type: 'text', required: true },
      {
        name: 'applicationType',
        label: 'Application Type',
        type: 'select',
        options: ['Injunction', 'Discovery', 'Summary Judgment', 'Other'],
        required: true,
      },
      { name: 'grounds', label: 'Grounds for Application', type: 'textarea', required: true },
      { name: 'relief', label: 'Relief Sought', type: 'textarea', required: true },
    ],
  },
];
