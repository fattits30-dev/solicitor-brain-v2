import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { typedApiClient, ApiError } from '@/lib/typed-api-client';
import type { 
  LegalResearchRequest, 
  LegalSource,
  VerifiedCitation,
  CompanyInfo as SharedCompanyInfo
} from '../../../shared/api-types';
import {
  AlertCircle,
  BookOpen,
  Building,
  CheckCircle,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  Scale,
  Search,
  Shield,
  XCircle,
} from 'lucide-react';
import React, { useState } from 'react';

interface _LegislationResult {
  id: string;
  title: string;
  year: string;
  number: string;
  type: string;
  uri: string;
  description?: string;
  lastModified?: string;
  inForce: boolean;
}

interface _CaseUpdate {
  title: string;
  citation: string;
  court: string;
  date: string;
  summary: string;
  relevantActs: string[];
}

interface _CitationVerification {
  valid: boolean;
  fullReference: string;
  currentStatus: string;
  lastAmended?: string;
}

interface _CompanyInfo {
  companyNumber: string;
  companyName: string;
  companyStatus: string;
  incorporationDate: string;
  companyType: string;
  registeredOffice: {
    addressLine1: string;
    addressLine2?: string;
    locality: string;
    postalCode: string;
    country: string;
  };
  officers: Array<{
    name: string;
    role: string;
    appointedOn: string;
    nationality?: string;
  }>;
}

interface LegalResearchPanelProps {
  className?: string;
  caseId?: string;
}

export const LegalResearchPanel: React.FC<LegalResearchPanelProps> = ({ className, caseId }) => {
  const [activeTab, setActiveTab] = useState('research');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Research state
  const [researchQuery, setResearchQuery] = useState('');
  const [researchType, setResearchType] = useState<'employment' | 'data-protection' | 'general'>('employment');
  const [researchResults, setResearchResults] = useState<{
    relevantLegislation: LegalSource[];
    recentCases: LegalSource[];
    additionalContext: string;
  } | null>(null);

  // Citation verification state
  const [citationText, setCitationText] = useState('');
  const [citationResults, setCitationResults] = useState<{
    originalText?: string;
    verifiedCitations: VerifiedCitation[];
    unverifiedCitations: string[];
    confidence: number;
  } | null>(null);

  // Company research state
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<SharedCompanyInfo | null>(null);

  const handleLegalResearch = async () => {
    if (!researchQuery.trim()) return;

    setLoading(true);
    try {
      const researchRequest: LegalResearchRequest = {
        query: researchQuery,
        caseType: researchType,
        includeCompanyInfo: false,
      };

      const response = await typedApiClient.legalResearch(researchRequest);
      setResearchResults(response.legalResearch);

      toast({
        title: 'Legal Research Complete',
        description: `Found ${response.legalResearch.relevantLegislation.length} acts and ${response.legalResearch.recentCases.length} recent cases`,
      });
    } catch (err) {
      console.error('Legal research error:', err);
      const errorMessage = err instanceof ApiError 
        ? err.isValidationError() 
          ? `Validation Error: ${err.getValidationErrors().join(', ')}`
          : err.message
        : (err as Error).message;
      
      toast({
        title: 'Research Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCitationVerification = async () => {
    if (!citationText.trim()) return;

    setLoading(true);
    try {
      const response = await typedApiClient.verifyCitations(citationText);
      
      setCitationResults({
        verifiedCitations: response.verifiedCitations.filter(c => c.verified),
        unverifiedCitations: response.verifiedCitations.filter(c => !c.verified).map(c => c.citation),
        confidence: response.verificationRate,
      });

      toast({
        title: 'Citation Verification Complete',
        description: `${response.verifiedCount} verified out of ${response.totalCitations} citations`,
      });
    } catch (err) {
      console.error('Citation verification error:', err);
      const errorMessage = err instanceof ApiError 
        ? err.isValidationError() 
          ? `Validation Error: ${err.getValidationErrors().join(', ')}`
          : err.message
        : (err as Error).message;
      
      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyResearch = async () => {
    if (!companyQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/ai/research-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ companyIdentifier: companyQuery }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setCompanyResults(data.company);

      toast({
        title: 'Company Research Complete',
        description: `Found information for ${data.company?.companyName || companyQuery}`,
      });
    } catch (error: any) {
      console.error('Company research error:', error);
      setCompanyResults(null);
      toast({
        title: 'Company Research Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Legal Research & Verification
          {caseId && (
            <Badge variant="outline" className="ml-2 text-xs">
              Case: {caseId}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="research" className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              Research
            </TabsTrigger>
            <TabsTrigger value="citations" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Citations
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex items-center gap-1">
              <Building className="h-3 w-3" />
              Companies
            </TabsTrigger>
          </TabsList>

          {/* Legal Research Tab */}
          <TabsContent value="research" className="flex-1 flex flex-col space-y-4">
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search UK legislation and case law..."
                    value={researchQuery}
                    onChange={(e) => setResearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLegalResearch()}
                  />
                </div>
                <Select value={researchType} onValueChange={(v: any) => setResearchType(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employment">Employment</SelectItem>
                    <SelectItem value="data-protection">Data Protection</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleLegalResearch} disabled={loading || !researchQuery.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {researchResults && (
              <ScrollArea className="flex-1">
                <div className="space-y-4">
                  {/* Relevant Legislation */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Gavel className="h-4 w-4 text-primary" />
                      Relevant Legislation ({researchResults.relevantLegislation.length})
                    </h4>
                    <div className="space-y-2">
                      {researchResults.relevantLegislation.map((act) => (
                        <Card key={act.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-sm truncate">{act.title}</h5>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {act.year}
                                </Badge>
                                <Badge 
                                  variant={act.inForce ? "default" : "secondary"} 
                                  className="text-xs"
                                >
                                  {act.inForce ? 'In Force' : 'Not In Force'}
                                </Badge>
                              </div>
                              {act.description && (
                                <p className="text-xs text-muted-foreground mt-1">{act.description}</p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={act.uri} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Recent Cases */}
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-primary" />
                      Recent Cases ({researchResults.recentCases.length})
                    </h4>
                    <div className="space-y-2">
                      {researchResults.recentCases.map((case_) => (
                        <Card key={case_.citation} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h5 className="font-medium text-sm">{case_.title}</h5>
                              <Badge variant="outline" className="text-xs">
                                {case_.court}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{case_.summary}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {case_.citation}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{case_.date}</span>
                            </div>
                            {case_.relevantActs.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {case_.relevantActs.map((act) => (
                                  <Badge key={act} variant="outline" className="text-xs">
                                    {act}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Additional Context */}
                  {researchResults.additionalContext && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        Additional Context
                      </h4>
                      <Card className="p-3">
                        <p className="text-sm text-muted-foreground">
                          {researchResults.additionalContext}
                        </p>
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Citation Verification Tab */}
          <TabsContent value="citations" className="flex-1 flex flex-col space-y-4">
            <div className="space-y-3">
              <Textarea
                placeholder="Paste text with legal citations to verify..."
                value={citationText}
                onChange={(e) => setCitationText(e.target.value)}
                className="min-h-[100px]"
              />
              <Button onClick={handleCitationVerification} disabled={loading || !citationText.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                Verify Citations
              </Button>
            </div>

            {citationResults && (
              <ScrollArea className="flex-1">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Verified Citations ({citationResults.verifiedCitations.length})
                    </h4>
                    <div className="space-y-2">
                      {citationResults.verifiedCitations.map((citation, idx) => (
                        <Card key={idx} className="p-3 border-green-200">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{citation.fullReference}</p>
                              <Badge variant="default" className="text-xs mt-1">
                                {citation.currentStatus}
                              </Badge>
                              {citation.lastAmended && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Last amended: {citation.lastAmended}
                                </p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Unverified Citations ({citationResults.unverifiedCitations.length})
                    </h4>
                    <div className="space-y-2">
                      {citationResults.unverifiedCitations.map((citation, idx) => (
                        <Card key={idx} className="p-3 border-red-200">
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{citation}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="text-center">
                    <Badge variant="secondary" className="text-xs">
                      Overall Confidence: {citationResults.confidence * 10}/10
                    </Badge>
                  </div>
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Company Research Tab */}
          <TabsContent value="companies" className="flex-1 flex flex-col space-y-4">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Company name or number..."
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCompanyResearch()}
                  className="flex-1"
                />
                <Button onClick={handleCompanyResearch} disabled={loading || !companyQuery.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {companyResults && (
              <ScrollArea className="flex-1">
                <div className="space-y-4">
                  <Card className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-lg font-medium">{companyResults.companyName}</h4>
                          <p className="text-sm text-muted-foreground">
                            Company No. {companyResults.companyNumber}
                          </p>
                        </div>
                        <Badge variant={companyResults.companyStatus === 'active' ? 'default' : 'secondary'}>
                          {companyResults.companyStatus}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Type:</span> {companyResults.companyType}
                        </div>
                        <div>
                          <span className="font-medium">Incorporated:</span> {companyResults.incorporationDate}
                        </div>
                      </div>

                      <div>
                        <h5 className="font-medium text-sm mb-2">Registered Office</h5>
                        <div className="text-sm text-muted-foreground">
                          <p>{companyResults.registeredOffice.addressLine1}</p>
                          {companyResults.registeredOffice.addressLine2 && (
                            <p>{companyResults.registeredOffice.addressLine2}</p>
                          )}
                          <p>{companyResults.registeredOffice.locality}</p>
                          <p>{companyResults.registeredOffice.postalCode}</p>
                          <p>{companyResults.registeredOffice.country}</p>
                        </div>
                      </div>

                      {companyResults.officers.length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm mb-2">Officers ({companyResults.officers.length})</h5>
                          <div className="space-y-2">
                            {companyResults.officers.slice(0, 5).map((officer, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <span>{officer.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {officer.role}
                                </Badge>
                              </div>
                            ))}
                            {companyResults.officers.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                ...and {companyResults.officers.length - 5} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};