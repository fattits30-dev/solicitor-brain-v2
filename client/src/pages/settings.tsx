import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const aiSettingsSchema = z.object({
  embeddingModel: z.string(),
  llmModel: z.string(),
  ocrEngine: z.string(),
  maxTokens: z.number().min(100).max(4000),
  temperature: z.number().min(0).max(2),
});

const privacySettingsSchema = z.object({
  autoRedactPII: z.boolean(),
  auditRetention: z.string(),
  consentRequired: z.boolean(),
  dataExportFormat: z.string(),
});

type AISettings = z.infer<typeof aiSettingsSchema>;
type PrivacySettings = z.infer<typeof privacySettingsSchema>;

export default function Settings() {
  const [activeTab, setActiveTab] = useState("ai");
  const { toast } = useToast();

  // AI Settings Form
  const aiForm = useForm<AISettings>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      embeddingModel: "all-MiniLM-L6-v2",
      llmModel: "llama3.1:8b",
      ocrEngine: "tesseract",
      maxTokens: 2000,
      temperature: 0.7,
    },
  });

  // Privacy Settings Form
  const privacyForm = useForm<PrivacySettings>({
    resolver: zodResolver(privacySettingsSchema),
    defaultValues: {
      autoRedactPII: true,
      auditRetention: "7years",
      consentRequired: true,
      dataExportFormat: "json",
    },
  });

  const onAISubmit = (data: AISettings) => {
    // Simulate saving AI settings
    toast({ title: "AI settings saved", description: "Your AI model preferences have been updated." });
  };

  const onPrivacySubmit = (data: PrivacySettings) => {
    // Simulate saving privacy settings
    toast({ title: "Privacy settings saved", description: "Your privacy preferences have been updated." });
  };

  const handleDataExport = () => {
    // Simulate data export
    toast({ title: "Export started", description: "Your data export will be ready for download shortly." });
  };

  const handleRevokeAllConsent = () => {
    // Simulate consent revocation
    toast({ 
      title: "All consent revoked", 
      description: "AI processing consent has been revoked. Some features may be limited.",
      variant: "destructive"
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Settings" 
          subtitle="Configure AI models, privacy settings, and user preferences"
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="ai" data-testid="tab-ai">AI Models</TabsTrigger>
                <TabsTrigger value="privacy" data-testid="tab-privacy">Privacy</TabsTrigger>
                <TabsTrigger value="data" data-testid="tab-data">Data</TabsTrigger>
                <TabsTrigger value="system" data-testid="tab-system">System</TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Model Configuration</CardTitle>
                    <CardDescription>Configure local AI models for document processing and generation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...aiForm}>
                      <form onSubmit={aiForm.handleSubmit(onAISubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={aiForm.control}
                            name="embeddingModel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Embedding Model</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} data-testid="select-embedding-model">
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (Fast)</SelectItem>
                                    <SelectItem value="all-mpnet-base-v2">all-mpnet-base-v2 (Accurate)</SelectItem>
                                    <SelectItem value="e5-large-v2">e5-large-v2 (Premium)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>Model used for document embeddings and semantic search</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={aiForm.control}
                            name="llmModel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Language Model</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} data-testid="select-llm-model">
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="llama3.1:8b">Llama 3.1 8B (Balanced)</SelectItem>
                                    <SelectItem value="llama3.1:70b">Llama 3.1 70B (High Quality)</SelectItem>
                                    <SelectItem value="mistral:7b">Mistral 7B (Fast)</SelectItem>
                                    <SelectItem value="phi3:3.8b">Phi-3 3.8B (Efficient)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>Model used for draft generation and content analysis</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <FormField
                            control={aiForm.control}
                            name="ocrEngine"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>OCR Engine</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} data-testid="select-ocr-engine">
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="tesseract">Tesseract (Free)</SelectItem>
                                    <SelectItem value="paddleocr">PaddleOCR (Better)</SelectItem>
                                    <SelectItem value="easyocr">EasyOCR (Premium)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={aiForm.control}
                            name="maxTokens"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Tokens</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} data-testid="input-max-tokens" />
                                </FormControl>
                                <FormDescription>Maximum tokens for AI responses</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={aiForm.control}
                            name="temperature"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Temperature</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.1" {...field} onChange={(e) => field.onChange(Number(e.target.value))} data-testid="input-temperature" />
                                </FormControl>
                                <FormDescription>Creativity level (0.0 - 2.0)</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <Button type="submit" data-testid="save-ai-settings">
                          <i className="fas fa-save mr-2"></i>
                          Save AI Settings
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="privacy" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Privacy Controls</CardTitle>
                    <CardDescription>Manage consent, data redaction, and privacy preferences</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...privacyForm}>
                      <form onSubmit={privacyForm.handleSubmit(onPrivacySubmit)} className="space-y-6">
                        <div className="space-y-4">
                          <FormField
                            control={privacyForm.control}
                            name="autoRedactPII"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between space-y-0">
                                <div className="space-y-1">
                                  <FormLabel>Automatic PII Redaction</FormLabel>
                                  <FormDescription>
                                    Automatically detect and redact personal information in logs and search results
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="toggle-auto-redact"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={privacyForm.control}
                            name="consentRequired"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between space-y-0">
                                <div className="space-y-1">
                                  <FormLabel>Require AI Consent</FormLabel>
                                  <FormDescription>
                                    Show consent dialogs before processing documents with AI technology
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="toggle-consent-required"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={privacyForm.control}
                            name="auditRetention"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Audit Log Retention</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} data-testid="select-audit-retention">
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="1year">1 Year</SelectItem>
                                    <SelectItem value="3years">3 Years</SelectItem>
                                    <SelectItem value="7years">7 Years (Recommended)</SelectItem>
                                    <SelectItem value="indefinite">Indefinite</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>How long to keep audit trail records</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={privacyForm.control}
                            name="dataExportFormat"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Data Export Format</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} data-testid="select-export-format">
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="json">JSON</SelectItem>
                                    <SelectItem value="csv">CSV</SelectItem>
                                    <SelectItem value="pdf">PDF Report</SelectItem>
                                    <SelectItem value="xml">XML</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>Preferred format for data exports</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <Button type="submit" data-testid="save-privacy-settings">
                          <i className="fas fa-save mr-2"></i>
                          Save Privacy Settings
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-destructive">
                  <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>Irreversible actions that affect your data and privacy</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                      <div>
                        <h4 className="font-medium text-foreground">Revoke All AI Consent</h4>
                        <p className="text-sm text-muted-foreground">Stop all AI processing and remove existing consent records</p>
                      </div>
                      <Button variant="destructive" onClick={handleRevokeAllConsent} data-testid="revoke-all-consent">
                        <i className="fas fa-ban mr-2"></i>
                        Revoke Consent
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="data" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Data Management</CardTitle>
                    <CardDescription>Export your data and manage storage preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-medium text-foreground">Data Export</h4>
                        <p className="text-sm text-muted-foreground">
                          Export all your case data, documents, and AI-generated content in your preferred format.
                        </p>
                        <Button onClick={handleDataExport} className="w-full" data-testid="export-all-data">
                          <i className="fas fa-download mr-2"></i>
                          Export All Data
                        </Button>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="font-medium text-foreground">Storage Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Documents stored:</span>
                            <span className="text-foreground font-medium" data-testid="storage-documents">143 files</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total storage used:</span>
                            <span className="text-foreground font-medium" data-testid="storage-used">2.4 GB</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">AI embeddings:</span>
                            <span className="text-foreground font-medium" data-testid="storage-embeddings">12,847 vectors</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="system" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>System Information</CardTitle>
                    <CardDescription>Current system status and version information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-medium text-foreground">Application Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Version:</span>
                            <Badge variant="outline" data-testid="app-version">v1.0.0</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Environment:</span>
                            <Badge variant="outline" data-testid="app-environment">Development</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Database:</span>
                            <Badge className="text-secondary" variant="outline" data-testid="database-status-system">Connected</Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="font-medium text-foreground">AI Services</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ollama Status:</span>
                            <Badge className="text-secondary" variant="outline" data-testid="ollama-status">Online</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Vector Database:</span>
                            <Badge className="text-secondary" variant="outline" data-testid="vector-db-status">pgvector Ready</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">OCR Service:</span>
                            <Badge className="text-secondary" variant="outline" data-testid="ocr-service-status">Available</Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">About Solicitor Brain</h4>
                      <p className="text-sm text-muted-foreground">
                        A trauma-informed, privacy-first legal case management system with AI-powered assistance. 
                        Built specifically for UK solicitors with comprehensive data protection and audit capabilities.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
