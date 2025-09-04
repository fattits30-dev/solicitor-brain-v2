/**
 * TypeScript type definitions for MCP (Model Context Protocol) integration in React frontend
 * These types ensure type safety for all MCP context managers and operations
 */

// Core MCP Types (synced with server)
export type MCPCategory = 'task' | 'decision' | 'progress' | 'note' | 'error' | 'warning';
export type MCPPriority = 'high' | 'normal' | 'low';
export type MCPSortOrder = 'created_desc' | 'created_asc' | 'updated_desc' | 'key_asc' | 'key_desc';
export type FileChangeType = 'add' | 'change' | 'unlink';

// Memory Context Types
export interface MCPContextItem {
  key: string;
  value: string;
  category?: MCPCategory;
  priority?: MCPPriority;
  channel?: string;
  private?: boolean;
  sessionId?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

export interface MCPSearchOptions {
  query?: string;
  category?: MCPCategory;
  channel?: string;
  channels?: string[];
  limit?: number;
  offset?: number;
  sort?: MCPSortOrder;
  priorities?: MCPPriority[];
  sessionId?: string;
  keyPattern?: string;
  createdAfter?: string;
  createdBefore?: string;
  includeMetadata?: boolean;
}

export interface MCPMemoryStatus {
  enabled: boolean;
  sessionCount?: number;
  itemCount?: number;
  channels?: string[];
  lastActivity?: string;
  connected: boolean;
}

// File Operations Types
export interface MCPFileInfo {
  path: string;
  name: string;
  size: number;
  type: 'file' | 'directory';
  lastModified: string;
  permissions?: string;
  hash?: string;
}

export interface MCPFileOperation {
  id: string;
  type: 'read' | 'write' | 'move' | 'delete' | 'copy' | 'upload';
  path: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface MCPFileWatch {
  id: string;
  path: string;
  recursive: boolean;
  patterns?: string[];
  active: boolean;
  lastEvent?: string;
}

export interface MCPFileChange {
  id: string;
  path: string;
  type: FileChangeType;
  timestamp: string;
  hash?: string;
  size?: number;
  relativePath?: string;
}

// Git Integration Types
export interface MCPGitStatus {
  clean: boolean;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  branch: string;
  remoteUrl?: string;
}

export interface MCPGitOperation {
  id: string;
  type: 'add' | 'commit' | 'push' | 'pull' | 'checkout' | 'merge' | 'rebase';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  files?: string[];
  branch?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  hash?: string;
}

export interface MCPGitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

// Workflow Types
export interface MCPWorkflowStep {
  id: string;
  name: string;
  description: string;
  type: 'file_operation' | 'ai_operation' | 'git_operation' | 'user_input' | 'validation';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  dependencies?: string[];
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface MCPWorkflow {
  id: string;
  name: string;
  description: string;
  type: 'document_processing' | 'case_management' | 'ai_analysis' | 'legal_research' | 'custom';
  status: 'draft' | 'running' | 'completed' | 'failed' | 'paused';
  steps: MCPWorkflowStep[];
  caseId?: string;
  userId: string;
  metadata?: Record<string, any>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
}

export interface MCPAIOperation {
  id: string;
  type: 'chat' | 'analysis' | 'summary' | 'extraction' | 'classification' | 'generation';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  model?: string;
  prompt?: string;
  response?: string;
  tokens?: { input: number; output: number };
  error?: string;
  startedAt: string;
  completedAt?: string;
  caseId?: string;
  documentId?: string;
}

// System Status Types
export interface MCPServiceStatus {
  name: string;
  type: 'mcp_tool' | 'api_service' | 'database' | 'file_system' | 'ai_model';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: string;
  responseTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MCPSystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: MCPServiceStatus[];
  lastUpdate: string;
  uptime: number;
}

// Real-time Updates
export interface MCPRealtimeUpdate {
  type: 'memory' | 'file' | 'git' | 'workflow' | 'system';
  action: 'create' | 'update' | 'delete' | 'status_change';
  id: string;
  data: any;
  timestamp: string;
  sessionId?: string;
}

// WebSocket Message Types
export interface MCPWebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'update' | 'heartbeat' | 'error';
  payload?: any;
  timestamp: string;
  id?: string;
}

// API Response Types
export interface MCPApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Context State Types
export interface MCPLoadingState {
  [operation: string]: boolean;
}

export interface MCPErrorState {
  [operation: string]: string | null;
}

// Hook Options
export interface MCPHookOptions {
  pollInterval?: number;
  realtime?: boolean;
  autoRefresh?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
}

// Legal Domain Specific Types
export interface LegalWorkflowContext {
  caseId: string;
  clientId?: string;
  documentIds?: string[];
  workflowType: 'contract_review' | 'case_analysis' | 'document_drafting' | 'compliance_check';
  jurisdiction?: string;
  confidentialityLevel: 'public' | 'confidential' | 'highly_confidential';
}

export interface LegalDocument {
  id: string;
  name: string;
  type: 'contract' | 'pleading' | 'correspondence' | 'evidence' | 'research';
  status: 'draft' | 'under_review' | 'approved' | 'executed';
  confidentiality: 'public' | 'confidential' | 'highly_confidential';
  caseId?: string;
  clientId?: string;
  createdAt: string;
  lastModified: string;
  version: number;
  tags: string[];
  metadata: Record<string, any>;
}

// Configuration Types
export interface MCPContextConfig {
  baseUrl: string;
  websocketUrl: string;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  batchSize: number;
  enableRealtime: boolean;
  enableCaching: boolean;
  cacheTimeout: number;
}

// Default Configuration
export const DEFAULT_MCP_CONFIG: MCPContextConfig = {
  baseUrl: '/api/mcp',
  websocketUrl: '/ws/mcp',
  retryAttempts: 3,
  retryDelay: 1000,
  timeout: 30000,
  batchSize: 100,
  enableRealtime: true,
  enableCaching: true,
  cacheTimeout: 300000, // 5 minutes
};