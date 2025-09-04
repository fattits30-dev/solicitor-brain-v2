/**
 * TypeScript type definitions for MCP (Model Context Protocol) integration
 * These types ensure type safety for memory-keeper and other MCP tool interactions
 */

export type MCPCategory = 'task' | 'decision' | 'progress' | 'note' | 'error' | 'warning';
export type MCPPriority = 'high' | 'normal' | 'low';
export type MCPSortOrder = 'created_desc' | 'created_asc' | 'updated_desc' | 'key_asc' | 'key_desc';

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

export interface MCPFileCache {
  filePath: string;
  content: string;
  hash?: string;
  timestamp?: string;
}

export interface MCPFileChangeInfo {
  changed: boolean;
  previousHash?: string;
  currentHash?: string;
  timestamp?: string;
}

export interface MCPMemoryStatus {
  enabled: boolean;
  sessionCount?: number;
  itemCount?: number;
  channels?: string[];
  lastActivity?: string;
}

export interface MCPToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    tool: string;
    parameters: any;
  };
}

// File change specific types for memory-keeper integration
export interface FileChangeMemoryData {
  path: string;
  type: 'add' | 'change' | 'unlink';
  timestamp: string;
  hash?: string;
  size?: number;
  relativePath?: string;
}

// MCP Tool parameter types
export interface MCPSaveParameters {
  key: string;
  value: string;
  category?: MCPCategory;
  priority?: MCPPriority;
  channel?: string;
  private?: boolean;
}

export interface MCPGetParameters {
  key?: string;
  category?: MCPCategory;
  channel?: string;
  sessionId?: string;
  includeMetadata?: boolean;
}

export interface MCPSearchParameters extends MCPSearchOptions {
  query: string;
}

export interface MCPCacheFileParameters {
  filePath: string;
  content: string;
}

export interface MCPFileChangedParameters {
  filePath: string;
  currentContent?: string;
}

// Event types for file watcher MCP integration
export interface FileWatcherMemoryEvent {
  type: 'save' | 'search' | 'cache' | 'status';
  success: boolean;
  data?: any;
  error?: Error;
  timestamp: Date;
}

export interface FileWatcherMemoryConfig {
  enabled: boolean;
  channel: string;
  defaultPriority: MCPPriority;
  cacheFiles: boolean;
  maxCacheSize: number;
}

// Utility types
export type FileChangeType = 'add' | 'change' | 'unlink';
export type FileWatcherChannel = 'file-watcher';

// Export default configuration
export const DEFAULT_MCP_CONFIG: FileWatcherMemoryConfig = {
  enabled: false,
  channel: 'file-watcher',
  defaultPriority: 'normal',
  cacheFiles: true,
  maxCacheSize: 1000,
};