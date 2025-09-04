import { useState, useEffect } from 'react';
// import { useQuery } from "@tanstack/react-query";
import { format } from 'date-fns';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AIJob {
  id: string;
  type: 'ocr' | 'embedding' | 'search' | 'draft' | 'summary';
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  caseId?: string;
  documentId?: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

interface SystemStatus {
  aiModels: {
    embedding: { status: 'online' | 'offline' | 'error'; responseTime: number };
    llm: { status: 'online' | 'offline' | 'error'; responseTime: number };
    ocr: { status: 'online' | 'offline' | 'error'; responseTime: number };
  };
  database: { status: 'connected' | 'disconnected'; latency: number };
  storage: { usage: number; available: number };
  queues: {
    pending: number;
    processing: number;
    failed: number;
  };
}

export default function Activity() {
  const [aiJobs, setAIJobs] = useState<AIJob[]>([]);
  const [systemStatus, _setSystemStatus] = useState<SystemStatus>({
    aiModels: {
      embedding: { status: 'online', responseTime: 145 },
      llm: { status: 'online', responseTime: 1200 },
      ocr: { status: 'online', responseTime: 890 },
    },
    database: { status: 'connected', latency: 23 },
    storage: { usage: 2.4, available: 47.6 },
    queues: { pending: 3, processing: 1, failed: 0 },
  });

  // Simulate real-time updates
  useEffect(() => {
    // Simulate initial AI jobs
    const mockJobs: AIJob[] = [
      {
        id: 'job1',
        type: 'ocr',
        status: 'completed',
        progress: 100,
        caseId: 'case1',
        documentId: 'doc1',
        startedAt: new Date(Date.now() - 300000), // 5 minutes ago
        completedAt: new Date(Date.now() - 120000), // 2 minutes ago
        metadata: { fileName: 'contract_signed.pdf', pages: 12 },
      },
      {
        id: 'job2',
        type: 'embedding',
        status: 'running',
        progress: 65,
        caseId: 'case1',
        documentId: 'doc1',
        startedAt: new Date(Date.now() - 90000), // 1.5 minutes ago
        metadata: { chunks: 8, processed: 5 },
      },
      {
        id: 'job3',
        type: 'search',
        status: 'queued',
        progress: 0,
        startedAt: new Date(),
        metadata: { query: 'employment termination clauses', searchType: 'semantic' },
      },
    ];

    setAIJobs(mockJobs);

    // Simulate periodic updates
    const interval = setInterval(() => {
      setAIJobs((prev) =>
        prev.map((job) => {
          if (job.status === 'running' && job.progress < 100) {
            return { ...job, progress: Math.min(job.progress + Math.random() * 10, 100) };
          }
          return job;
        }),
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getJobIcon = (type: string) => {
    switch (type) {
      case 'ocr':
        return 'fas fa-eye text-primary';
      case 'embedding':
        return 'fas fa-brain text-secondary';
      case 'search':
        return 'fas fa-search text-accent';
      case 'draft':
        return 'fas fa-edit text-primary';
      case 'summary':
        return 'fas fa-file-text text-secondary';
      default:
        return 'fas fa-cog text-muted-foreground';
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'ocr':
        return 'OCR Processing';
      case 'embedding':
        return 'Vector Embeddings';
      case 'search':
        return 'AI Search';
      case 'draft':
        return 'Document Drafting';
      case 'summary':
        return 'Content Summary';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
        return 'bg-muted text-muted-foreground';
      case 'running':
        return 'bg-primary text-primary-foreground';
      case 'completed':
        return 'bg-secondary text-secondary-foreground';
      case 'failed':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getServiceStatus = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
        return 'text-secondary';
      case 'offline':
      case 'disconnected':
        return 'text-muted-foreground';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="AI Activity"
          subtitle="Real-time view of AI agent operations and background jobs"
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* System Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
                      <i className="fas fa-brain text-secondary"></i>
                    </div>
                    <div>
                      <p
                        className="text-sm font-medium text-foreground"
                        data-testid="status-ai-models"
                      >
                        AI Models
                      </p>
                      <p className={`text-xs ${getServiceStatus('online')}`}>All services online</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <i className="fas fa-database text-primary"></i>
                    </div>
                    <div>
                      <p
                        className="text-sm font-medium text-foreground"
                        data-testid="status-database"
                      >
                        Database
                      </p>
                      <p className={`text-xs ${getServiceStatus('connected')}`}>
                        {systemStatus.database.latency}ms latency
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
                      <i className="fas fa-tasks text-accent"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground" data-testid="status-queue">
                        Processing Queue
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {systemStatus.queues.processing} active jobs
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
                      <i className="fas fa-hdd text-secondary"></i>
                    </div>
                    <div>
                      <p
                        className="text-sm font-medium text-foreground"
                        data-testid="status-storage"
                      >
                        Storage
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {systemStatus.storage.usage} GB used
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="jobs" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="jobs" data-testid="tab-jobs">
                  AI Jobs
                </TabsTrigger>
                <TabsTrigger value="system" data-testid="tab-system">
                  System Health
                </TabsTrigger>
                <TabsTrigger value="performance" data-testid="tab-performance">
                  Performance
                </TabsTrigger>
              </TabsList>

              <TabsContent value="jobs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>AI Processing Jobs</CardTitle>
                        <CardDescription>
                          Real-time status of document processing, search, and drafting tasks
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" data-testid="total-jobs-count">
                          {aiJobs.length} total jobs
                        </Badge>
                        <Button variant="ghost" size="sm" data-testid="refresh-jobs">
                          <i className="fas fa-sync-alt mr-2"></i>
                          Refresh
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {aiJobs.length === 0 ? (
                        <div
                          className="text-center text-muted-foreground p-8"
                          data-testid="no-jobs"
                        >
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-robot text-2xl"></i>
                          </div>
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            No active AI jobs
                          </h3>
                          <p className="text-sm">
                            AI processing jobs will appear here as you upload documents and generate
                            drafts.
                          </p>
                        </div>
                      ) : (
                        aiJobs.map((job) => (
                          <div
                            key={job.id}
                            className="border border-border rounded-lg p-4"
                            data-testid={`ai-job-${job.id}`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <i className={getJobIcon(job.type)}></i>
                                </div>
                                <div>
                                  <h3
                                    className="font-medium text-foreground"
                                    data-testid={`job-type-${job.id}`}
                                  >
                                    {getJobTypeLabel(job.type)}
                                  </h3>
                                  <p
                                    className="text-sm text-muted-foreground"
                                    data-testid={`job-started-${job.id}`}
                                  >
                                    Started {format(job.startedAt, 'HH:mm:ss')}
                                  </p>
                                </div>
                              </div>
                              <Badge
                                className={getStatusColor(job.status)}
                                data-testid={`job-status-${job.id}`}
                              >
                                {job.status}
                              </Badge>
                            </div>

                            {job.status === 'running' && (
                              <div className="mb-3">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span
                                    className="text-foreground"
                                    data-testid={`job-progress-${job.id}`}
                                  >
                                    {Math.round(job.progress)}%
                                  </span>
                                </div>
                                <Progress value={job.progress} className="h-2" />
                              </div>
                            )}

                            {job.metadata && (
                              <div
                                className="text-sm text-muted-foreground"
                                data-testid={`job-metadata-${job.id}`}
                              >
                                {job.type === 'ocr' && job.metadata.fileName && (
                                  <span>
                                    Processing {job.metadata.fileName} ({job.metadata.pages} pages)
                                  </span>
                                )}
                                {job.type === 'embedding' && job.metadata.chunks && (
                                  <span>
                                    Creating embeddings: {job.metadata.processed || 0}/
                                    {job.metadata.chunks} chunks
                                  </span>
                                )}
                                {job.type === 'search' && job.metadata.query && (
                                  <span>Searching for: "{job.metadata.query}"</span>
                                )}
                              </div>
                            )}

                            {job.error && (
                              <Alert className="mt-3" data-testid={`job-error-${job.id}`}>
                                <i className="fas fa-exclamation-triangle"></i>
                                <AlertDescription>{job.error}</AlertDescription>
                              </Alert>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="system" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Services Status</CardTitle>
                      <CardDescription>Health and response times for AI components</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <i className="fas fa-brain text-secondary"></i>
                          <span className="font-medium">Embedding Model</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={getServiceStatus(systemStatus.aiModels.embedding.status)}
                            variant="outline"
                            data-testid="embedding-status"
                          >
                            {systemStatus.aiModels.embedding.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {systemStatus.aiModels.embedding.responseTime}ms
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <i className="fas fa-robot text-primary"></i>
                          <span className="font-medium">Language Model</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={getServiceStatus(systemStatus.aiModels.llm.status)}
                            variant="outline"
                            data-testid="llm-status"
                          >
                            {systemStatus.aiModels.llm.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {systemStatus.aiModels.llm.responseTime}ms
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <i className="fas fa-eye text-accent"></i>
                          <span className="font-medium">OCR Engine</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={getServiceStatus(systemStatus.aiModels.ocr.status)}
                            variant="outline"
                            data-testid="ocr-status"
                          >
                            {systemStatus.aiModels.ocr.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {systemStatus.aiModels.ocr.responseTime}ms
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Infrastructure Status</CardTitle>
                      <CardDescription>Database, storage, and system resources</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <i className="fas fa-database text-primary"></i>
                          <span className="font-medium">PostgreSQL Database</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={getServiceStatus(systemStatus.database.status)}
                            variant="outline"
                            data-testid="database-status"
                          >
                            {systemStatus.database.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {systemStatus.database.latency}ms
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Storage Usage</span>
                          <span className="text-foreground" data-testid="storage-usage">
                            {systemStatus.storage.usage} GB / {systemStatus.storage.available} GB
                          </span>
                        </div>
                        <Progress
                          value={
                            (systemStatus.storage.usage / systemStatus.storage.available) * 100
                          }
                          className="h-2"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-accent" data-testid="queue-pending">
                            {systemStatus.queues.pending}
                          </p>
                          <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                        <div>
                          <p
                            className="text-2xl font-bold text-primary"
                            data-testid="queue-processing"
                          >
                            {systemStatus.queues.processing}
                          </p>
                          <p className="text-xs text-muted-foreground">Processing</p>
                        </div>
                        <div>
                          <p
                            className="text-2xl font-bold text-destructive"
                            data-testid="queue-failed"
                          >
                            {systemStatus.queues.failed}
                          </p>
                          <p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                    <CardDescription>
                      AI processing times and system performance indicators
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <i className="fas fa-stopwatch text-secondary text-2xl"></i>
                        </div>
                        <h3 className="font-medium text-foreground mb-1">Average OCR Time</h3>
                        <p className="text-2xl font-bold text-secondary" data-testid="avg-ocr-time">
                          2.3s
                        </p>
                        <p className="text-xs text-muted-foreground">per page</p>
                      </div>

                      <div className="text-center">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <i className="fas fa-search text-primary text-2xl"></i>
                        </div>
                        <h3 className="font-medium text-foreground mb-1">Search Response</h3>
                        <p
                          className="text-2xl font-bold text-primary"
                          data-testid="avg-search-time"
                        >
                          0.8s
                        </p>
                        <p className="text-xs text-muted-foreground">average time</p>
                      </div>

                      <div className="text-center">
                        <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <i className="fas fa-edit text-accent text-2xl"></i>
                        </div>
                        <h3 className="font-medium text-foreground mb-1">Draft Generation</h3>
                        <p className="text-2xl font-bold text-accent" data-testid="avg-draft-time">
                          3.1s
                        </p>
                        <p className="text-xs text-muted-foreground">per document</p>
                      </div>
                    </div>

                    <div className="mt-8 p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-foreground mb-3">
                        Recent Performance Trends
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">OCR accuracy rate</span>
                          <span className="text-secondary font-medium">98.7%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Search relevance score</span>
                          <span className="text-primary font-medium">94.2%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Draft quality rating</span>
                          <span className="text-accent font-medium">91.8%</span>
                        </div>
                      </div>
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
