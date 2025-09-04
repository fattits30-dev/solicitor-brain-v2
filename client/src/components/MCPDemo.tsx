/**
 * MCP Integration Demo Component
 * 
 * Demonstrates usage of all MCP Context Managers including:
 * - Memory operations and persistent state
 * - File operations and real-time updates
 * - Git integration with workflow context
 * - Legal workflow orchestration
 * - System monitoring and health checks
 */

import React, { useEffect, useState } from 'react';
import {
  useMCPIntegration,
  useMCPMemoryOperations,
  useMCPGitOperations,
  useMCPWorkflowOperations,
  useMCPSystemMonitoring,
  useLegalOperations,
  useMCPDevelopment,
} from '../hooks/useMCPIntegration';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function MCPDemo() {
  const integration = useMCPIntegration({
    autoRefresh: true,
    pollInterval: 5000,
    onError: (error) => console.error('MCP Error:', error),
  });

  const memory = useMCPMemoryOperations();
  const git = useMCPGitOperations();
  const workflow = useMCPWorkflowOperations();
  const system = useMCPSystemMonitoring();
  const legal = useLegalOperations();
  const dev = useMCPDevelopment();

  const [noteKey, setNoteKey] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [caseId, setCaseId] = useState('');

  // Initialize development mode for demo
  useEffect(() => {
    dev.enableDevMode();
  }, [dev]);

  // Connection status indicator
  const ConnectionStatus = () => (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-3 h-3 rounded-full ${integration.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm">
        {integration.isConnected ? 'Connected to MCP Services' : 'Disconnected'}
      </span>
      {integration.isLoading && <span className="text-sm text-gray-500">Loading...</span>}
    </div>
  );

  // Memory Operations Demo
  const MemoryDemo = () => (
    <Card>
      <CardHeader>
        <CardTitle>Memory Operations</CardTitle>
        <CardDescription>
          Persistent context storage with search and categorization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            placeholder="Note key"
            value={noteKey}
            onChange={(e) => setNoteKey(e.target.value)}
          />
          <Input
            placeholder="Search query"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Textarea
          placeholder="Note content"
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          rows={3}
        />
        
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              if (noteKey && noteContent) {
                await memory.saveNote(noteKey, noteContent);
                setNoteKey('');
                setNoteContent('');
              }
            }}
            disabled={!noteKey || !noteContent || memory.loading.save}
          >
            Save Note
          </Button>
          
          <Button
            variant="outline"
            onClick={async () => {
              if (searchQuery) {
                await memory.quickSearch(searchQuery);
              }
            }}
            disabled={!searchQuery || memory.loading.search}
          >
            Search
          </Button>
          
          <Button
            variant="outline"
            onClick={() => memory.getRecentItems(10)}
            disabled={memory.loading.getAll}
          >
            Get Recent
          </Button>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium mb-2">
            Memory Items ({memory.items.length})
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2">
            {memory.items.slice(0, 5).map((item) => (
              <div key={item.key} className="p-2 bg-gray-50 rounded text-sm">
                <div className="font-medium">{item.key}</div>
                <div className="text-gray-600 truncate">{item.value}</div>
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {item.category}
                  </Badge>
                  {item.priority === 'high' && (
                    <Badge variant="destructive" className="text-xs">
                      High Priority
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {memory.searchResults.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">
                Search Results ({memory.searchResults.length})
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {memory.searchResults.map((item) => (
                  <div key={item.key} className="p-2 bg-blue-50 rounded text-sm">
                    <div className="font-medium">{item.key}</div>
                    <div className="text-gray-600 truncate">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // File Operations Demo
  const FileDemo = () => (
    <Card>
      <CardHeader>
        <CardTitle>File Operations</CardTitle>
        <CardDescription>
          File system operations - Coming Soon
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center text-muted-foreground p-8">
          <div className="text-lg font-medium mb-2">File Operations</div>
          <div className="text-sm">
            File system operations will be available in a future update.
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Git Operations Demo
  const GitDemo = () => (
    <Card>
      <CardHeader>
        <CardTitle>Git Integration</CardTitle>
        <CardDescription>
          Version control with workflow integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={() => git.refreshStatus()}
            disabled={git.loading.refreshStatus}
          >
            Refresh Status
          </Button>
          
          <Button
            variant="outline"
            onClick={() => git.smartCommit('Demo commit from MCP', { addAll: true })}
            disabled={!git.hasUncommittedChanges || git.loading.commit}
          >
            Smart Commit
          </Button>
        </div>

        {git.status && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">Branch: {git.currentBranch}</div>
              <div>Status: {git.isClean ? 'Clean' : 'Changes pending'}</div>
            </div>
            <div>
              <div>Staged: {git.status.staged.length}</div>
              <div>Unstaged: {git.status.unstaged.length}</div>
              <div>Untracked: {git.status.untracked.length}</div>
            </div>
          </div>
        )}

        {git.commits.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Recent Commits</div>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {git.commits.slice(0, 3).map((commit) => (
                <div key={commit.hash} className="p-2 border rounded text-sm">
                  <div className="font-mono text-xs">{commit.hash.substring(0, 8)}</div>
                  <div className="font-medium">{commit.message}</div>
                  <div className="text-gray-500">{commit.author} - {new Date(commit.date).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Workflow Demo
  const WorkflowDemo = () => (
    <Card>
      <CardHeader>
        <CardTitle>Legal Workflows</CardTitle>
        <CardDescription>
          Automated legal document processing workflows
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Case ID"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
        />
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={async () => {
              if (caseId) {
                await legal.startCaseWork(caseId);
              }
            }}
            disabled={!caseId}
          >
            Start Case Work
          </Button>
          
          <Button
            variant="outline"
            onClick={async () => {
              const workflowId = await workflow.createLegalWorkflow('contract_review', {
                caseId: caseId || 'demo-case',
                workflowType: 'contract_review',
                confidentialityLevel: 'confidential',
              });
              await workflow.startWorkflow(workflowId);
            }}
          >
            Contract Review
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium">Active</div>
            <div className="text-2xl">{workflow.activeWorkflowCount}</div>
          </div>
          <div>
            <div className="font-medium">Completed</div>
            <div className="text-2xl">{workflow.completedWorkflowCount}</div>
          </div>
          <div>
            <div className="font-medium">Failed</div>
            <div className="text-2xl">{workflow.failedWorkflowCount}</div>
          </div>
        </div>

        {workflow.workflows.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Workflows</div>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {workflow.workflows.slice(0, 3).map((wf) => (
                <div key={wf.id} className="p-2 border rounded text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{wf.name}</div>
                    <Badge variant={
                      wf.status === 'completed' ? 'default' :
                      wf.status === 'running' ? 'secondary' :
                      wf.status === 'failed' ? 'destructive' : 'outline'
                    }>
                      {wf.status}
                    </Badge>
                  </div>
                  <div className="mt-1">
                    <Progress value={wf.progress} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // System Monitoring Demo
  const SystemDemo = () => (
    <Card>
      <CardHeader>
        <CardTitle>System Monitoring</CardTitle>
        <CardDescription>
          Real-time system health and service monitoring
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={() => system.performHealthCheck()}
            disabled={system.loading.performHealthCheck}
          >
            Health Check
          </Button>
          
          <Button
            variant="outline"
            onClick={() => system.enableMonitoring(!system.monitoringEnabled)}
          >
            {system.monitoringEnabled ? 'Stop' : 'Start'} Monitoring
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium">Health Score</div>
            <div className="text-3xl font-bold text-green-600">{system.healthScore}%</div>
          </div>
          <div>
            <div className="text-sm font-medium">Avg Response Time</div>
            <div className="text-3xl font-bold">{system.avgResponseTime}ms</div>
          </div>
        </div>

        {system.criticalAlertCount > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Critical Alerts</AlertTitle>
            <AlertDescription>
              {system.criticalAlertCount} critical alerts require attention.
            </AlertDescription>
          </Alert>
        )}

        {system.services.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Services Status</div>
            <div className="space-y-2">
              {system.services.slice(0, 5).map((service) => (
                <div key={service.name} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div>{service.name}</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      service.status === 'healthy' ? 'bg-green-500' :
                      service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span>{service.responseTime}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Development Tools Demo
  const DevDemo = () => (
    <Card>
      <CardHeader>
        <CardTitle>Development Tools</CardTitle>
        <CardDescription>
          Development utilities and debugging tools
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={() => dev.runHealthChecks()}
            disabled={!dev.devMode}
          >
            Run Health Checks
          </Button>
          
          <Button
            variant="outline"
            onClick={() => dev.seedTestData()}
            disabled={!dev.devMode}
          >
            Seed Test Data
          </Button>
          
          <Button
            variant="outline"
            onClick={() => dev.clearTestData()}
            disabled={!dev.devMode}
          >
            Clear Test Data
          </Button>
        </div>

        <div className="text-sm space-y-2">
          <div>
            Dev Mode: <Badge variant={dev.devMode ? 'default' : 'outline'}>
              {dev.devMode ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <div>Integration Status: {integration.healthSummary.overall}</div>
          <div>Last Update: {integration.healthSummary.lastUpdate}</div>
        </div>

        {integration.hasErrors && (
          <Alert variant="destructive">
            <AlertTitle>Integration Errors</AlertTitle>
            <AlertDescription>
              Some MCP services have errors. Check the browser console for details.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">MCP Integration Demo</h1>
        <p className="text-gray-600 mb-4">
          Comprehensive demonstration of Model Context Protocol integration for legal workflow management
        </p>
        <ConnectionStatus />
      </div>

      <Tabs defaultValue="memory" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="git">Git</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="dev">Dev Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="memory" className="mt-6">
          <MemoryDemo />
        </TabsContent>

        <TabsContent value="files" className="mt-6">
          <FileDemo />
        </TabsContent>

        <TabsContent value="git" className="mt-6">
          <GitDemo />
        </TabsContent>

        <TabsContent value="workflow" className="mt-6">
          <WorkflowDemo />
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <SystemDemo />
        </TabsContent>

        <TabsContent value="dev" className="mt-6">
          <DevDemo />
        </TabsContent>
      </Tabs>

      {/* Summary Panel */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Integration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{memory.items.length}</div>
              <div className="text-sm text-gray-600">Memory Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{git.branches.length}</div>
              <div className="text-sm text-gray-600">Branches</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{workflow.workflows.length}</div>
              <div className="text-sm text-gray-600">Workflows</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{system.healthScore}%</div>
              <div className="text-sm text-gray-600">Health Score</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default MCPDemo;