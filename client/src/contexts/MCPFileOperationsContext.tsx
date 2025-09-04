/**
 * MCP File Operations Context Manager
 * 
 * Provides React context for MCP filesystem operations including:
 * - File and directory operations (CRUD)
 * - File watching and real-time change detection
 * - Upload progress tracking and management
 * - File searching and metadata operations
 * - Bulk operations and batch processing
 */

import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  MCPFileInfo,
  MCPFileOperation,
  MCPFileWatch,
  MCPFileChange,
  MCPApiResponse,
  MCPLoadingState,
  MCPErrorState,
  MCPHookOptions,
  DEFAULT_MCP_CONFIG,
} from '../types/mcp';

// Context State Interface
interface MCPFileOperationsState {
  // Core file state
  currentDirectory: string;
  files: MCPFileInfo[];
  selectedFiles: string[];
  
  // Operations tracking
  operations: MCPFileOperation[];
  activeUploads: MCPFileOperation[];
  
  // File watching
  watchers: MCPFileWatch[];
  recentChanges: MCPFileChange[];
  
  // Search and filtering
  searchResults: MCPFileInfo[];
  searchQuery: string;
  filters: {
    type?: 'file' | 'directory';
    extension?: string;
    sizeMin?: number;
    sizeMax?: number;
    dateMin?: string;
    dateMax?: string;
  };
  
  // State management
  loading: MCPLoadingState;
  errors: MCPErrorState;
  connected: boolean;
  lastUpdate: string | null;
}

// Action Types
type MCPFileOperationsAction =
  | { type: 'SET_LOADING'; operation: string; loading: boolean }
  | { type: 'SET_ERROR'; operation: string; error: string | null }
  | { type: 'SET_CURRENT_DIRECTORY'; path: string }
  | { type: 'SET_FILES'; files: MCPFileInfo[] }
  | { type: 'ADD_FILE'; file: MCPFileInfo }
  | { type: 'UPDATE_FILE'; path: string; updates: Partial<MCPFileInfo> }
  | { type: 'REMOVE_FILE'; path: string }
  | { type: 'SET_SELECTED_FILES'; paths: string[] }
  | { type: 'ADD_OPERATION'; operation: MCPFileOperation }
  | { type: 'UPDATE_OPERATION'; id: string; updates: Partial<MCPFileOperation> }
  | { type: 'REMOVE_OPERATION'; id: string }
  | { type: 'ADD_WATCHER'; watcher: MCPFileWatch }
  | { type: 'UPDATE_WATCHER'; id: string; updates: Partial<MCPFileWatch> }
  | { type: 'REMOVE_WATCHER'; id: string }
  | { type: 'ADD_FILE_CHANGE'; change: MCPFileChange }
  | { type: 'SET_SEARCH_RESULTS'; results: MCPFileInfo[]; query: string }
  | { type: 'SET_FILTERS'; filters: any }
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'SET_LAST_UPDATE'; timestamp: string };

// Context Interface
interface MCPFileOperationsContextType extends MCPFileOperationsState {
  // Directory Operations
  navigateToDirectory: (path: string) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  deleteDirectory: (path: string) => Promise<void>;
  moveDirectory: (source: string, destination: string) => Promise<void>;
  
  // File Operations
  readFile: (path: string) => Promise<string | null>;
  writeFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  moveFile: (source: string, destination: string) => Promise<void>;
  copyFile: (source: string, destination: string) => Promise<void>;
  
  // Upload Operations
  uploadFiles: (files: FileList, targetPath?: string) => Promise<void>;
  pauseUpload: (operationId: string) => Promise<void>;
  resumeUpload: (operationId: string) => Promise<void>;
  cancelUpload: (operationId: string) => Promise<void>;
  
  // Batch Operations
  batchDelete: (paths: string[]) => Promise<void>;
  batchMove: (operations: { source: string; destination: string }[]) => Promise<void>;
  batchDownload: (paths: string[]) => Promise<void>;
  
  // File Watching
  addWatcher: (path: string, recursive?: boolean, patterns?: string[]) => Promise<string>;
  removeWatcher: (watcherId: string) => Promise<void>;
  pauseWatcher: (watcherId: string) => Promise<void>;
  resumeWatcher: (watcherId: string) => Promise<void>;
  
  // Search Operations
  searchFiles: (query: string, path?: string, options?: any) => Promise<void>;
  clearSearch: () => void;
  setFileFilters: (filters: any) => void;
  
  // Selection Management
  selectFile: (path: string) => void;
  deselectFile: (path: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleSelection: (path: string) => void;
  
  // Metadata Operations
  getFileInfo: (path: string) => Promise<MCPFileInfo | null>;
  getDirectoryTree: (path: string) => Promise<any>;
  calculateDirectorySize: (path: string) => Promise<number>;
  
  // Utility Functions
  refreshDirectory: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearErrors: (operation?: string) => void;
  retry: (operationId: string) => Promise<void>;
}

// Initial State
const initialState: MCPFileOperationsState = {
  currentDirectory: '/',
  files: [],
  selectedFiles: [],
  operations: [],
  activeUploads: [],
  watchers: [],
  recentChanges: [],
  searchResults: [],
  searchQuery: '',
  filters: {},
  loading: {},
  errors: {},
  connected: false,
  lastUpdate: null,
};

// Reducer
function mcpFileOperationsReducer(
  state: MCPFileOperationsState,
  action: MCPFileOperationsAction
): MCPFileOperationsState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.operation]: action.loading },
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.operation]: action.error },
      };
    
    case 'SET_CURRENT_DIRECTORY':
      return { ...state, currentDirectory: action.path };
    
    case 'SET_FILES':
      return {
        ...state,
        files: action.files,
        lastUpdate: new Date().toISOString(),
      };
    
    case 'ADD_FILE':
      return {
        ...state,
        files: [action.file, ...state.files],
        lastUpdate: new Date().toISOString(),
      };
    
    case 'UPDATE_FILE':
      return {
        ...state,
        files: state.files.map(file =>
          file.path === action.path ? { ...file, ...action.updates } : file
        ),
        lastUpdate: new Date().toISOString(),
      };
    
    case 'REMOVE_FILE':
      return {
        ...state,
        files: state.files.filter(file => file.path !== action.path),
        selectedFiles: state.selectedFiles.filter(path => path !== action.path),
        lastUpdate: new Date().toISOString(),
      };
    
    case 'SET_SELECTED_FILES':
      return { ...state, selectedFiles: action.paths };
    
    case 'ADD_OPERATION':
      return {
        ...state,
        operations: [action.operation, ...state.operations],
        activeUploads: action.operation.type === 'upload'
          ? [action.operation, ...state.activeUploads]
          : state.activeUploads,
      };
    
    case 'UPDATE_OPERATION':
      return {
        ...state,
        operations: state.operations.map(op =>
          op.id === action.id ? { ...op, ...action.updates } : op
        ),
        activeUploads: state.activeUploads.map(op =>
          op.id === action.id ? { ...op, ...action.updates } : op
        ),
      };
    
    case 'REMOVE_OPERATION':
      return {
        ...state,
        operations: state.operations.filter(op => op.id !== action.id),
        activeUploads: state.activeUploads.filter(op => op.id !== action.id),
      };
    
    case 'ADD_WATCHER':
      return {
        ...state,
        watchers: [action.watcher, ...state.watchers],
      };
    
    case 'UPDATE_WATCHER':
      return {
        ...state,
        watchers: state.watchers.map(watcher =>
          watcher.id === action.id ? { ...watcher, ...action.updates } : watcher
        ),
      };
    
    case 'REMOVE_WATCHER':
      return {
        ...state,
        watchers: state.watchers.filter(watcher => watcher.id !== action.id),
      };
    
    case 'ADD_FILE_CHANGE':
      return {
        ...state,
        recentChanges: [action.change, ...state.recentChanges.slice(0, 99)], // Keep last 100
      };
    
    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: action.results,
        searchQuery: action.query,
      };
    
    case 'SET_FILTERS':
      return { ...state, filters: action.filters };
    
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };
    
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdate: action.timestamp };
    
    default:
      return state;
  }
}

// Context Creation
const MCPFileOperationsContext = createContext<MCPFileOperationsContextType | undefined>(undefined);

// Provider Component
export function MCPFileOperationsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mcpFileOperationsReducer, initialState);
  const { token, user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // API Helper Function
  const apiCall = async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<MCPApiResponse<T>> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${DEFAULT_MCP_CONFIG.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Error Handler
  const handleError = (operation: string, error: any) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dispatch({ type: 'SET_ERROR', operation, error: errorMessage });
    dispatch({ type: 'SET_LOADING', operation, loading: false });
  };

  // Directory Operations
  const navigateToDirectory = async (path: string) => {
    const _operation = 'navigate';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<MCPFileInfo[]>('/files/list', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_DIRECTORY', path });
        dispatch({ type: 'SET_FILES', files: response.data });
      }
    } catch (error) {
      handleError(_operation, error as Error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const createDirectory = async (path: string) => {
    const _operation = 'createDirectory';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall('/files/create-directory', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });

      if (response.success) {
        const newDir: MCPFileInfo = {
          path,
          name: path.split('/').pop() || '',
          size: 0,
          type: 'directory',
          lastModified: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_FILE', file: newDir });
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const deleteDirectory = async (path: string) => {
    const _operation = 'deleteDirectory';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall('/files/delete', {
        method: 'DELETE',
        body: JSON.stringify({ path }),
      });

      if (response.success) {
        dispatch({ type: 'REMOVE_FILE', path });
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const moveDirectory = async (source: string, destination: string) => {
    const _operation = 'moveDirectory';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'move',
        path: source,
        status: 'pending',
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/files/move', {
        method: 'POST',
        body: JSON.stringify({ source, destination }),
      });

      if (response.success) {
        dispatch({ type: 'REMOVE_FILE', path: source });
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
      }
    } catch (error) {
      dispatch({
        type: 'UPDATE_OPERATION',
        id: operationId,
        updates: { status: 'failed', error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  };

  // File Operations
  const readFile = async (path: string): Promise<string | null> => {
    const _operation = 'readFile';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<{ content: string }>('/files/read', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });

      if (response.success && response.data) {
        return response.data.content;
      }
      return null;
    } catch (error) {
      handleError(_operation, error as Error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const writeFile = async (path: string, content: string) => {
    const _operation = 'writeFile';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'write',
        path,
        status: 'pending',
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/files/write', {
        method: 'POST',
        body: JSON.stringify({ path, content }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        
        // Update file info if it exists
        const existingFile = state.files.find(f => f.path === path);
        if (existingFile) {
          dispatch({
            type: 'UPDATE_FILE',
            path,
            updates: {
              size: content.length,
              lastModified: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error) {
      dispatch({
        type: 'UPDATE_OPERATION',
        id: operationId,
        updates: { status: 'failed', error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  };

  const deleteFile = async (path: string) => {
    const _operation = 'deleteFile';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall('/files/delete', {
        method: 'DELETE',
        body: JSON.stringify({ path }),
      });

      if (response.success) {
        dispatch({ type: 'REMOVE_FILE', path });
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const moveFile = async (source: string, destination: string) => {
    return moveDirectory(source, destination); // Same logic
  };

  const copyFile = async (source: string, destination: string) => {
    const _operation = 'copyFile';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'copy',
        path: source,
        status: 'pending',
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/files/copy', {
        method: 'POST',
        body: JSON.stringify({ source, destination }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
      }
    } catch (error) {
      dispatch({
        type: 'UPDATE_OPERATION',
        id: operationId,
        updates: { status: 'failed', error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  };

  // Upload Operations
  const uploadFiles = async (files: FileList, targetPath?: string) => {
    const uploads = Array.from(files).map(file => {
      const operationId = Date.now().toString() + Math.random().toString(36);
      const path = `${targetPath || state.currentDirectory}/${file.name}`;

      const operation: MCPFileOperation = {
        id: operationId,
        type: 'upload',
        path,
        status: 'pending',
        progress: 0,
        startedAt: new Date().toISOString(),
      };

      dispatch({ type: 'ADD_OPERATION', operation });
      return { file, operation };
    });

    for (const { file, operation } of uploads) {
      try {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operation.id,
          updates: { status: 'in_progress' },
        });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', targetPath || state.currentDirectory);

        const response = await fetch(`${DEFAULT_MCP_CONFIG.baseUrl}/files/upload`, {
          method: 'POST',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: formData,
        });

        if (response.ok) {
          dispatch({
            type: 'UPDATE_OPERATION',
            id: operation.id,
            updates: {
              status: 'completed',
              progress: 100,
              completedAt: new Date().toISOString(),
            },
          });

          // Add file to current directory if we're in the target path
          if ((targetPath || state.currentDirectory) === state.currentDirectory) {
            const newFile: MCPFileInfo = {
              path: operation.path,
              name: file.name,
              size: file.size,
              type: 'file',
              lastModified: new Date().toISOString(),
            };
            dispatch({ type: 'ADD_FILE', file: newFile });
          }
        } else {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
      } catch (error) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operation.id,
          updates: {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  };

  const pauseUpload = async (operationId: string) => {
    dispatch({
      type: 'UPDATE_OPERATION',
      id: operationId,
      updates: { status: 'pending' },
    });
  };

  const resumeUpload = async (operationId: string) => {
    dispatch({
      type: 'UPDATE_OPERATION',
      id: operationId,
      updates: { status: 'in_progress' },
    });
  };

  const cancelUpload = async (operationId: string) => {
    dispatch({ type: 'REMOVE_OPERATION', id: operationId });
  };

  // Batch Operations
  const batchDelete = async (paths: string[]) => {
    const operation = 'batchDelete';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/files/batch-delete', {
        method: 'DELETE',
        body: JSON.stringify({ paths }),
      });

      if (response.success) {
        paths.forEach(path => {
          dispatch({ type: 'REMOVE_FILE', path });
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const batchMove = async (operations: { source: string; destination: string }[]) => {
    for (const op of operations) {
      await moveFile(op.source, op.destination);
    }
  };

  const batchDownload = async (paths: string[]) => {
    const _operation = 'batchDownload';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await fetch(`${DEFAULT_MCP_CONFIG.baseUrl}/files/batch-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ paths }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'files.zip';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  // File Watching
  const addWatcher = async (path: string, recursive = false, patterns: string[] = []): Promise<string> => {
    const _operation = 'addWatcher';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<{ watcherId: string }>('/files/watch', {
        method: 'POST',
        body: JSON.stringify({ path, recursive, patterns }),
      });

      if (response.success && response.data) {
        const watcher: MCPFileWatch = {
          id: response.data.watcherId,
          path,
          recursive,
          patterns,
          active: true,
        };
        dispatch({ type: 'ADD_WATCHER', watcher });
        return response.data.watcherId;
      }
      throw new Error('Failed to create watcher');
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const removeWatcher = async (watcherId: string) => {
    const _operation = 'removeWatcher';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall('/files/unwatch', {
        method: 'DELETE',
        body: JSON.stringify({ watcherId }),
      });

      if (response.success) {
        dispatch({ type: 'REMOVE_WATCHER', id: watcherId });
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const pauseWatcher = async (watcherId: string) => {
    dispatch({
      type: 'UPDATE_WATCHER',
      id: watcherId,
      updates: { active: false },
    });
  };

  const resumeWatcher = async (watcherId: string) => {
    dispatch({
      type: 'UPDATE_WATCHER',
      id: watcherId,
      updates: { active: true },
    });
  };

  // Search Operations
  const searchFiles = async (query: string, path?: string, options: any = {}) => {
    const _operation = 'search';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<MCPFileInfo[]>('/files/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          path: path || state.currentDirectory,
          ...options,
        }),
      });

      if (response.success && response.data) {
        dispatch({
          type: 'SET_SEARCH_RESULTS',
          results: response.data,
          query,
        });
      }
    } catch (error) {
      handleError(_operation, error as Error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const clearSearch = () => {
    dispatch({ type: 'SET_SEARCH_RESULTS', results: [], query: '' });
    dispatch({ type: 'SET_FILTERS', filters: {} });
  };

  const setFileFilters = (filters: any) => {
    dispatch({ type: 'SET_FILTERS', filters });
  };

  // Selection Management
  const selectFile = (path: string) => {
    if (!state.selectedFiles.includes(path)) {
      dispatch({
        type: 'SET_SELECTED_FILES',
        paths: [...state.selectedFiles, path],
      });
    }
  };

  const deselectFile = (path: string) => {
    dispatch({
      type: 'SET_SELECTED_FILES',
      paths: state.selectedFiles.filter(p => p !== path),
    });
  };

  const selectAll = () => {
    dispatch({
      type: 'SET_SELECTED_FILES',
      paths: state.files.map(f => f.path),
    });
  };

  const deselectAll = () => {
    dispatch({ type: 'SET_SELECTED_FILES', paths: [] });
  };

  const toggleSelection = (path: string) => {
    if (state.selectedFiles.includes(path)) {
      deselectFile(path);
    } else {
      selectFile(path);
    }
  };

  // Metadata Operations
  const getFileInfo = async (path: string): Promise<MCPFileInfo | null> => {
    const _operation = 'getFileInfo';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<MCPFileInfo>('/files/info', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(_operation, error as Error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const getDirectoryTree = async (path: string): Promise<any> => {
    const _operation = 'getDirectoryTree';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<any>('/files/tree', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(_operation, error as Error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const calculateDirectorySize = async (path: string): Promise<number> => {
    const _operation = 'calculateDirectorySize';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<{ size: number }>('/files/size', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });

      if (response.success && response.data) {
        return response.data.size;
      }
      return 0;
    } catch (error) {
      handleError(_operation, error as Error);
      return 0;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  // Utility Functions
  const refreshDirectory = async () => {
    await navigateToDirectory(state.currentDirectory);
  };

  const connect = async () => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${DEFAULT_MCP_CONFIG.websocketUrl}/files`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        dispatch({ type: 'SET_CONNECTED', connected: true });
        ws.send(JSON.stringify({
          type: 'auth',
          token,
          userId: user?.id,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'file_change': {
              const change: MCPFileChange = {
                id: Date.now().toString(),
                path: message.data.path,
                type: message.data.type,
                timestamp: message.data.timestamp,
                hash: message.data.hash,
                size: message.data.size,
              };
              dispatch({ type: 'ADD_FILE_CHANGE', change });
              
              // Update file list if change is in current directory
              if (message.data.path.startsWith(state.currentDirectory)) {
                if (message.data.type === 'add') {
                  // Fetch new file info
                  getFileInfo(message.data.path).then(fileInfo => {
                    if (fileInfo) {
                      dispatch({ type: 'ADD_FILE', file: fileInfo });
                    }
                  });
                } else if (message.data.type === 'unlink') {
                  dispatch({ type: 'REMOVE_FILE', path: message.data.path });
                } else if (message.data.type === 'change') {
                  dispatch({
                    type: 'UPDATE_FILE',
                    path: message.data.path,
                    updates: {
                      lastModified: message.data.timestamp,
                      size: message.data.size,
                    },
                  });
                }
              }
              break;
            }
            
            case 'upload_progress':
              dispatch({
                type: 'UPDATE_OPERATION',
                id: message.data.operationId,
                updates: { progress: message.data.progress },
              });
              break;
          }
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        dispatch({ type: 'SET_CONNECTED', connected: false });
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    dispatch({ type: 'SET_CONNECTED', connected: false });
  };

  const clearErrors = (operation?: string) => {
    if (operation) {
      dispatch({ type: 'SET_ERROR', operation, error: null });
    } else {
      Object.keys(state.errors).forEach(op => {
        dispatch({ type: 'SET_ERROR', operation: op, error: null });
      });
    }
  };

  const retry = async (operationId: string) => {
    const operation = state.operations.find(op => op.id === operationId);
    if (!operation) return;

    // Retry logic based on operation type
    switch (operation.type) {
      case 'upload':
        // Retry upload logic would go here
        break;
      case 'move':
        // Retry move logic would go here
        break;
      default:
        console.warn(`Retry not implemented for operation type: ${operation.type}`);
    }
  };

  // Effects
  useEffect(() => {
    if (token && user) {
      navigateToDirectory('/');
      if (DEFAULT_MCP_CONFIG.enableRealtime) {
        connect();
      }
    }

    return () => {
      disconnect();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [token, user]);

  // Context value
  const contextValue: MCPFileOperationsContextType = {
    ...state,
    navigateToDirectory,
    createDirectory,
    deleteDirectory,
    moveDirectory,
    readFile,
    writeFile,
    deleteFile,
    moveFile,
    copyFile,
    uploadFiles,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    batchDelete,
    batchMove,
    batchDownload,
    addWatcher,
    removeWatcher,
    pauseWatcher,
    resumeWatcher,
    searchFiles,
    clearSearch,
    setFileFilters,
    selectFile,
    deselectFile,
    selectAll,
    deselectAll,
    toggleSelection,
    getFileInfo,
    getDirectoryTree,
    calculateDirectorySize,
    refreshDirectory,
    connect,
    disconnect,
    clearErrors,
    retry,
  };

  return (
    <MCPFileOperationsContext.Provider value={contextValue}>
      {children}
    </MCPFileOperationsContext.Provider>
  );
}

// Hook
export function useMCPFileOperations(options: MCPHookOptions = {}) {
  const context = useContext(MCPFileOperationsContext);
  if (!context) {
    throw new Error('useMCPFileOperations must be used within an MCPFileOperationsProvider');
  }

  const { onError, onSuccess: _onSuccess, autoRefresh, pollInterval } = options;

  // Handle errors
  useEffect(() => {
    if (onError) {
      Object.entries(context.errors).forEach(([operation, error]) => {
        if (error) {
          onError(new Error(`${operation}: ${error}`));
        }
      });
    }
  }, [context.errors, onError]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh && pollInterval) {
      const interval = setInterval(() => {
        context.refreshDirectory();
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, pollInterval, context]);

  return context;
}