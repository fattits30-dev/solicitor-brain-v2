import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import type { Case, InsertCase, Document, Event, Draft } from '@shared/schema';
import { insertCaseSchema } from '@shared/schema';

export default function Cases() {
  const { id: caseId } = useParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  // Queries
  const { data: cases, isLoading: casesLoading } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
  });

  const { data: selectedCase, isLoading: _caseLoading } = useQuery<Case>({
    queryKey: ['/api/cases', caseId],
    enabled: !!caseId,
  });

  const { data: caseDocuments } = useQuery<Document[]>({
    queryKey: ['/api/cases', caseId, 'documents'],
    enabled: !!caseId,
  });

  const { data: caseEvents } = useQuery<Event[]>({
    queryKey: ['/api/cases', caseId, 'events'],
    enabled: !!caseId,
  });

  const { data: caseDrafts } = useQuery<Draft[]>({
    queryKey: ['/api/cases', caseId, 'drafts'],
    enabled: !!caseId,
  });

  // Mutations
  const createCaseMutation = useMutation({
    mutationFn: async (data: InsertCase) => {
      return apiClient.post('/api/cases', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      setShowCreateModal(false);
      toast({
        title: 'Case created successfully',
        description: 'Your new case has been created and is ready for documents.',
      });
    },
    onError: () => {
      toast({
        title: 'Error creating case',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Form
  const form = useForm<InsertCase>({
    resolver: zodResolver(insertCaseSchema),
    defaultValues: {
      title: '',
      status: 'active',
      riskLevel: 'medium',
    },
  });

  const onSubmit = (data: InsertCase) => {
    createCaseMutation.mutate(data);
  };

  // Filter cases
  const filteredCases =
    cases?.filter((case_) => {
      const matchesSearch =
        case_.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        case_.clientRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        case_.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || case_.status === statusFilter;
      return matchesSearch && matchesStatus;
    }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-secondary text-secondary-foreground';
      case 'pending':
        return 'bg-accent text-accent-foreground';
      case 'closed':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-destructive text-destructive-foreground';
      case 'medium':
        return 'bg-accent text-accent-foreground';
      case 'low':
        return 'bg-secondary text-secondary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCaseIcon = (title: string) => {
    if (title.toLowerCase().includes('employment')) return 'fas fa-briefcase';
    if (title.toLowerCase().includes('property')) return 'fas fa-home';
    if (title.toLowerCase().includes('contract')) return 'fas fa-file-contract';
    if (title.toLowerCase().includes('family')) return 'fas fa-users';
    return 'fas fa-folder-open';
  };

  if (caseId && selectedCase) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header
            title={selectedCase.title}
            subtitle={`Case Reference: ${selectedCase.clientRef || 'N/A'} • ${selectedCase.status}`}
          >
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              data-testid="back-to-cases"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Cases
            </Button>
          </Header>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Case Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <i
                          className={`${getCaseIcon(selectedCase.title)} text-primary text-xl`}
                        ></i>
                      </div>
                      <div>
                        <CardTitle data-testid="case-detail-title">{selectedCase.title}</CardTitle>
                        <CardDescription data-testid="case-detail-description">
                          {selectedCase.description || 'No description provided'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        className={getRiskColor(selectedCase.riskLevel)}
                        data-testid="case-risk-badge"
                      >
                        {selectedCase.riskLevel} risk
                      </Badge>
                      <Badge
                        className={getStatusColor(selectedCase.status)}
                        data-testid="case-status-badge"
                      >
                        {selectedCase.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Client Reference</p>
                      <p className="font-medium" data-testid="case-client-ref">
                        {selectedCase.clientRef || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium" data-testid="case-created-date">
                        {format(new Date(selectedCase.createdAt), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Updated</p>
                      <p className="font-medium" data-testid="case-updated-date">
                        {format(new Date(selectedCase.updatedAt), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Case Details Tabs */}
              <Tabs defaultValue="timeline" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="timeline" data-testid="tab-timeline">
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="documents" data-testid="tab-documents">
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="drafts" data-testid="tab-drafts">
                    Drafts
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Case Timeline</CardTitle>
                      <CardDescription>Recent events and activities for this case</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {caseEvents?.length === 0 ? (
                        <div
                          className="text-center text-muted-foreground p-8"
                          data-testid="no-events"
                        >
                          No events recorded yet. Events will appear here as case activity occurs.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {caseEvents?.map((event) => (
                            <div
                              key={event.id}
                              className="flex items-start space-x-4 p-4 border border-border rounded-lg"
                              data-testid={`event-${event.id}`}
                            >
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                <i className="fas fa-clock text-primary text-sm"></i>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <h4
                                    className="font-medium text-foreground"
                                    data-testid={`event-kind-${event.id}`}
                                  >
                                    {event.kind.charAt(0).toUpperCase() + event.kind.slice(1)}
                                  </h4>
                                  <span
                                    className="text-xs text-muted-foreground"
                                    data-testid={`event-date-${event.id}`}
                                  >
                                    {format(new Date(event.happenedAt), 'dd MMM yyyy HH:mm')}
                                  </span>
                                </div>
                                {event.data && (
                                  <p
                                    className="text-sm text-muted-foreground mt-1"
                                    data-testid={`event-data-${event.id}`}
                                  >
                                    {typeof event.data === 'string'
                                      ? event.data
                                      : String(JSON.stringify(event.data))}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Case Documents</CardTitle>
                      <CardDescription>All documents associated with this case</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {caseDocuments?.length === 0 ? (
                        <div
                          className="text-center text-muted-foreground p-8"
                          data-testid="no-documents"
                        >
                          No documents uploaded yet. Use the Upload page to add documents to this
                          case.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {caseDocuments?.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-4 border border-border rounded-lg"
                              data-testid={`document-${doc.id}`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                                  <i className="fas fa-file-alt text-accent"></i>
                                </div>
                                <div>
                                  <p
                                    className="font-medium text-foreground"
                                    data-testid={`document-type-${doc.id}`}
                                  >
                                    {doc.type}
                                  </p>
                                  <p
                                    className="text-sm text-muted-foreground"
                                    data-testid={`document-source-${doc.id}`}
                                  >
                                    {doc.source}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p
                                  className="text-xs text-muted-foreground"
                                  data-testid={`document-date-${doc.id}`}
                                >
                                  {format(new Date(doc.createdAt), 'dd MMM yyyy')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="drafts" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Legal Drafts</CardTitle>
                      <CardDescription>AI-assisted drafts and legal documents</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {caseDrafts?.length === 0 ? (
                        <div
                          className="text-center text-muted-foreground p-8"
                          data-testid="no-drafts"
                        >
                          No drafts created yet. Use the Draft Studio to create AI-assisted legal
                          documents.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {caseDrafts?.map((draft) => (
                            <div
                              key={draft.id}
                              className="p-4 border border-border rounded-lg"
                              data-testid={`draft-${draft.id}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4
                                  className="font-medium text-foreground"
                                  data-testid={`draft-title-${draft.id}`}
                                >
                                  {draft.title}
                                </h4>
                                <Badge
                                  className={
                                    draft.status === 'final'
                                      ? 'bg-secondary text-secondary-foreground'
                                      : 'bg-muted text-muted-foreground'
                                  }
                                  data-testid={`draft-status-${draft.id}`}
                                >
                                  {draft.status}
                                </Badge>
                              </div>
                              <p
                                className="text-sm text-muted-foreground mb-2"
                                data-testid={`draft-tone-${draft.id}`}
                              >
                                Tone: {draft.tone}
                              </p>
                              <p
                                className="text-xs text-muted-foreground"
                                data-testid={`draft-date-${draft.id}`}
                              >
                                {format(new Date(draft.updatedAt), 'dd MMM yyyy HH:mm')}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Cases" subtitle="Manage your legal cases and case files">
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button data-testid="create-case-button">
                <i className="fas fa-plus mr-2"></i>
                New Case
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" data-testid="create-case-modal">
              <DialogHeader>
                <DialogTitle>Create New Case</DialogTitle>
                <DialogDescription>
                  Add a new legal case to your system. All information is stored securely.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Case Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Employment Tribunal - Client vs Company"
                            {...field}
                            data-testid="input-case-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientRef"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Reference</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Internal reference number"
                            {...field}
                            data-testid="input-client-ref"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="riskLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Risk Level</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          data-testid="select-risk-level"
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select risk level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low Risk</SelectItem>
                            <SelectItem value="medium">Medium Risk</SelectItem>
                            <SelectItem value="high">High Risk</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of the case..."
                            {...field}
                            data-testid="input-case-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-col-reverse sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1"
                      data-testid="cancel-create-case"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createCaseMutation.isPending}
                      className="flex-1"
                      data-testid="submit-create-case"
                    >
                      {createCaseMutation.isPending ? 'Creating...' : 'Create Case'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </Header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Search and Filter */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search cases by title, client reference, or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="search-cases"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    data-testid="filter-status"
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cases</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Cases List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Cases</CardTitle>
                    <CardDescription>
                      {filteredCases.length} of {cases?.length || 0} cases shown
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {casesLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center space-x-4 p-4">
                          <div className="w-12 h-12 bg-muted rounded-lg"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredCases.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8" data-testid="no-cases">
                    {searchTerm || statusFilter !== 'all'
                      ? 'No cases match your search criteria.'
                      : 'No cases found. Create your first case to get started.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCases.map((case_) => (
                      <div
                        key={case_.id}
                        className="group cursor-pointer"
                        onClick={() => (window.location.href = `/cases/${case_.id}`)}
                      >
                        <div
                          className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                          data-testid={`case-row-${case_.id}`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              <i className={`${getCaseIcon(case_.title)} text-primary`}></i>
                            </div>
                            <div>
                              <h3
                                className="font-medium text-foreground group-hover:text-primary transition-colors"
                                data-testid={`case-title-${case_.id}`}
                              >
                                {case_.title}
                              </h3>
                              <div className="flex items-center space-x-2 mt-1">
                                <p
                                  className="text-sm text-muted-foreground"
                                  data-testid={`case-ref-${case_.id}`}
                                >
                                  Ref: {case_.clientRef || 'None'}
                                </p>
                                <Separator orientation="vertical" className="h-4" />
                                <p
                                  className="text-sm text-muted-foreground"
                                  data-testid={`case-updated-${case_.id}`}
                                >
                                  Updated {format(new Date(case_.updatedAt), 'dd MMM')}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge
                              className={getRiskColor(case_.riskLevel)}
                              data-testid={`case-risk-${case_.id}`}
                            >
                              {case_.riskLevel}
                            </Badge>
                            <Badge
                              className={getStatusColor(case_.status)}
                              data-testid={`case-status-${case_.id}`}
                            >
                              {case_.status}
                            </Badge>
                            <i className="fas fa-chevron-right text-muted-foreground group-hover:text-primary transition-colors"></i>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
