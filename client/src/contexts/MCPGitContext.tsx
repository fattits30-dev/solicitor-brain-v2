/**
 * MCP Git Integration Context Manager
 * 
 * Provides React context for MCP Git operations including:
 * - Git repository management and status tracking
 * - Commit operations with workflow integration
 * - Branch management and merging
 * - Real-time git state updates
 * - Legal workflow integration for version control
 */

import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  MCPGitStatus,
  MCPGitOperation,
  MCPGitCommit,
  MCPApiResponse,
  MCPLoadingState,
  MCPErrorState,
  MCPHookOptions,
  DEFAULT_MCP_CONFIG,
} from '../types/mcp';

// Context State Interface
interface MCPGitContextState {
  // Repository state
  repositoryPath: string | null;
  status: MCPGitStatus | null;
  commits: MCPGitCommit[];
  branches: string[];
  currentBranch: string | null;
  remotes: { name: string; url: string }[];
  
  // Operations tracking
  operations: MCPGitOperation[];
  pendingChanges: string[];
  
  // Workflow integration
  workflowContext: {
    caseId?: string;
    userId?: string;
    workflowId?: string;
  };
  
  // State management
  loading: MCPLoadingState;
  errors: MCPErrorState;
  connected: boolean;
  autoCommit: boolean;
  lastUpdate: string | null;
}

// Action Types
type MCPGitAction =
  | { type: 'SET_LOADING'; operation: string; loading: boolean }
  | { type: 'SET_ERROR'; operation: string; error: string | null }
  | { type: 'SET_REPOSITORY_PATH'; path: string | null }
  | { type: 'SET_STATUS'; status: MCPGitStatus }
  | { type: 'SET_COMMITS'; commits: MCPGitCommit[] }
  | { type: 'ADD_COMMIT'; commit: MCPGitCommit }
  | { type: 'SET_BRANCHES'; branches: string[] }
  | { type: 'SET_CURRENT_BRANCH'; branch: string | null }
  | { type: 'SET_REMOTES'; remotes: { name: string; url: string }[] }
  | { type: 'ADD_OPERATION'; operation: MCPGitOperation }
  | { type: 'UPDATE_OPERATION'; id: string; updates: Partial<MCPGitOperation> }
  | { type: 'REMOVE_OPERATION'; id: string }
  | { type: 'SET_PENDING_CHANGES'; changes: string[] }
  | { type: 'SET_WORKFLOW_CONTEXT'; context: any }
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'SET_AUTO_COMMIT'; autoCommit: boolean }
  | { type: 'SET_LAST_UPDATE'; timestamp: string };

// Context Interface
interface MCPGitContextType extends MCPGitContextState {
  // Repository Operations
  initRepository: (path: string) => Promise<void>;
  setRepository: (path: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  
  // File Operations
  addFiles: (files: string[]) => Promise<void>;
  unstageFiles: (files: string[]) => Promise<void>;
  restoreFiles: (files: string[]) => Promise<void>;
  
  // Commit Operations
  commit: (message: string, workflowId?: string, caseId?: string) => Promise<string>;
  amendCommit: (message?: string) => Promise<void>;
  resetCommit: (commitHash: string, mode?: 'soft' | 'mixed' | 'hard') => Promise<void>;
  
  // Branch Operations
  createBranch: (branchName: string, baseBranch?: string) => Promise<void>;
  switchBranch: (branchName: string) => Promise<void>;
  deleteBranch: (branchName: string, force?: boolean) => Promise<void>;
  mergeBranch: (sourceBranch: string, targetBranch?: string) => Promise<void>;
  
  // Remote Operations
  addRemote: (name: string, url: string) => Promise<void>;
  removeRemote: (name: string) => Promise<void>;
  fetch: (remote?: string, branch?: string) => Promise<void>;
  pull: (remote?: string, branch?: string) => Promise<void>;
  push: (remote?: string, branch?: string, force?: boolean) => Promise<void>;
  
  // History and Information
  getCommitHistory: (limit?: number, branch?: string) => Promise<void>;
  getCommitDiff: (commitHash: string) => Promise<string | null>;
  getBranchList: (includeRemotes?: boolean) => Promise<void>;
  
  // Workflow Integration
  setWorkflowContext: (context: { caseId?: string; userId?: string; workflowId?: string }) => void;
  createWorkflowCommit: (message: string, files: string[], metadata?: any) => Promise<string>;
  tagCommit: (commitHash: string, tagName: string, message?: string) => Promise<void>;
  
  // Automation
  enableAutoCommit: (enabled: boolean) => void;
  scheduleAutoCommit: (intervalMinutes: number) => void;
  
  // Real-time Updates
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Utility Functions
  validateRepository: () => Promise<boolean>;
  getGitIgnoreRules: () => Promise<string[]>;
  updateGitIgnore: (rules: string[]) => Promise<void>;
  clearErrors: (operation?: string) => void;
  retry: (operationId: string) => Promise<void>;
}

// Initial State
const initialState: MCPGitContextState = {
  repositoryPath: null,
  status: null,
  commits: [],
  branches: [],
  currentBranch: null,
  remotes: [],
  operations: [],
  pendingChanges: [],
  workflowContext: {},
  loading: {},
  errors: {},
  connected: false,
  autoCommit: false,
  lastUpdate: null,
};

// Reducer
function mcpGitReducer(state: MCPGitContextState, action: MCPGitAction): MCPGitContextState {
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
    
    case 'SET_REPOSITORY_PATH':
      return { ...state, repositoryPath: action.path };
    
    case 'SET_STATUS':
      return {
        ...state,
        status: action.status,
        lastUpdate: new Date().toISOString(),
      };
    
    case 'SET_COMMITS':
      return { ...state, commits: action.commits };
    
    case 'ADD_COMMIT':
      return {
        ...state,
        commits: [action.commit, ...state.commits],
        lastUpdate: new Date().toISOString(),
      };
    
    case 'SET_BRANCHES':
      return { ...state, branches: action.branches };
    
    case 'SET_CURRENT_BRANCH':
      return { ...state, currentBranch: action.branch };
    
    case 'SET_REMOTES':
      return { ...state, remotes: action.remotes };
    
    case 'ADD_OPERATION':
      return {
        ...state,
        operations: [action.operation, ...state.operations],
      };
    
    case 'UPDATE_OPERATION':
      return {
        ...state,
        operations: state.operations.map(op =>
          op.id === action.id ? { ...op, ...action.updates } : op
        ),
      };
    
    case 'REMOVE_OPERATION':
      return {
        ...state,
        operations: state.operations.filter(op => op.id !== action.id),
      };
    
    case 'SET_PENDING_CHANGES':
      return { ...state, pendingChanges: action.changes };
    
    case 'SET_WORKFLOW_CONTEXT':
      return { ...state, workflowContext: action.context };
    
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };
    
    case 'SET_AUTO_COMMIT':
      return { ...state, autoCommit: action.autoCommit };
    
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdate: action.timestamp };
    
    default:
      return state;
  }
}

// Context Creation
const MCPGitContext = createContext<MCPGitContextType | undefined>(undefined);

// Provider Component
export function MCPGitProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mcpGitReducer, initialState);
  const { token, user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const autoCommitIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // API Helper Function
  const apiCall = async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<MCPApiResponse<T>> => {
    const response = await fetch(`${DEFAULT_MCP_CONFIG.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(options.headers || {}),
      } as HeadersInit,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  };

  // Error Handler
  const handleError = (operation: string, error: any) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dispatch({ type: 'SET_ERROR', operation, error: errorMessage });
    dispatch({ type: 'SET_LOADING', operation, loading: false });
  };

  // Repository Operations
  const initRepository = async (path: string) => {
    const _operation = 'initRepository';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall('/git/init', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });

      if (response.success) {
        dispatch({ type: 'SET_REPOSITORY_PATH', path });
        await refreshStatus();
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const setRepository = async (path: string) => {
    const _operation = 'setRepository';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const isValid = await validateRepository();
      if (isValid) {
        dispatch({ type: 'SET_REPOSITORY_PATH', path });
        await refreshStatus();
        await getCommitHistory();
        await getBranchList();
      } else {
        throw new Error('Invalid Git repository');
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const refreshStatus = async () => {
    const _operation = 'refreshStatus';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<MCPGitStatus>('/git/status', {
        method: 'POST',
        body: JSON.stringify({ repoPath: state.repositoryPath }),
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_STATUS', status: response.data });
        dispatch({ type: 'SET_CURRENT_BRANCH', branch: response.data.branch });
        dispatch({
          type: 'SET_PENDING_CHANGES',
          changes: [...response.data.staged, ...response.data.unstaged],
        });
      }
    } catch (error) {
      handleError(_operation, error as Error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  // File Operations
  const addFiles = async (files: string[]) => {
    const _operation = 'addFiles';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'add',
        status: 'pending',
        files,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/add', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          files,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await refreshStatus();
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

  const unstageFiles = async (files: string[]) => {
    const _operation = 'unstageFiles';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'add', // Using 'add' for unstage as well, could add more types
        status: 'pending',
        files,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/reset', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          files,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await refreshStatus();
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

  const restoreFiles = async (files: string[]) => {
    const _operation = 'restoreFiles';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'checkout',
        status: 'pending',
        files,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/restore', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          files,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await refreshStatus();
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

  // Commit Operations
  const commit = async (message: string, workflowId?: string, caseId?: string): Promise<string> => {
    const _operation = 'commit';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'commit',
        status: 'pending',
        message,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const commitMessage = workflowId || caseId 
        ? `${message}\n\n${workflowId ? `Workflow-ID: ${workflowId}\n` : ''}${caseId ? `Case-ID: ${caseId}\n` : ''}Generated with Solicitor Brain`
        : message;

      const response = await apiCall<{ hash: string }>('/git/commit', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          message: commitMessage,
          workflowId,
          caseId,
          userId: state.workflowContext.userId || user?.id,
        }),
      });

      if (response.success && response.data) {
        const newCommit: MCPGitCommit = {
          hash: response.data.hash,
          message: commitMessage,
          author: user?.name || 'Unknown',
          date: new Date().toISOString(),
          files: state.status?.staged || [],
        };

        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: {
            status: 'completed',
            completedAt: new Date().toISOString(),
            hash: response.data.hash,
          },
        });
        dispatch({ type: 'ADD_COMMIT', commit: newCommit });
        await refreshStatus();

        return response.data.hash;
      }

      throw new Error('Commit failed');
    } catch (error) {
      dispatch({
        type: 'UPDATE_OPERATION',
        id: operationId,
        updates: { status: 'failed', error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  };

  const amendCommit = async (message?: string) => {
    const _operation = 'amendCommit';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'commit',
        status: 'pending',
        message: message || 'Amend commit',
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/commit', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          message,
          amend: true,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await refreshStatus();
        await getCommitHistory();
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

  const resetCommit = async (commitHash: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed') => {
    const _operation = 'resetCommit';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'commit',
        status: 'pending',
        message: `Reset to ${commitHash}`,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/reset', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          commitHash,
          mode,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await refreshStatus();
        await getCommitHistory();
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

  // Branch Operations
  const createBranch = async (branchName: string, baseBranch?: string) => {
    const _operation = 'createBranch';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'checkout',
        status: 'pending',
        branch: branchName,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/branch/create', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          branchName,
          baseBranch,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await getBranchList();
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

  const switchBranch = async (branchName: string) => {
    const _operation = 'switchBranch';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'checkout',
        status: 'pending',
        branch: branchName,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/checkout', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          branchName,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        dispatch({ type: 'SET_CURRENT_BRANCH', branch: branchName });
        await refreshStatus();
        await getCommitHistory();
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

  const deleteBranch = async (branchName: string, force = false) => {
    const _operation = 'deleteBranch';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'checkout',
        status: 'pending',
        branch: branchName,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/branch/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          branchName,
          force,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await getBranchList();
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

  const mergeBranch = async (sourceBranch: string, targetBranch?: string) => {
    const _operation = 'mergeBranch';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'merge',
        status: 'pending',
        branch: sourceBranch,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/merge', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          sourceBranch,
          targetBranch: targetBranch || state.currentBranch,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await refreshStatus();
        await getCommitHistory();
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

  // Remote Operations
  const addRemote = async (name: string, url: string) => {
    const _operation = 'addRemote';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall('/git/remote/add', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          name,
          url,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'SET_REMOTES',
          remotes: [...state.remotes, { name, url }],
        });
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const removeRemote = async (name: string) => {
    const _operation = 'removeRemote';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall('/git/remote/remove', {
        method: 'DELETE',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          name,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'SET_REMOTES',
          remotes: state.remotes.filter(r => r.name !== name),
        });
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const fetch = async (remote = 'origin', branch?: string) => {
    const _operation = 'fetch';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'pull',
        status: 'pending',
        branch: branch || state.currentBranch || 'main',
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/fetch', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          remote,
          branch,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await refreshStatus();
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

  const pull = async (remote = 'origin', branch?: string) => {
    const _operation = 'pull';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'pull',
        status: 'pending',
        branch: branch || state.currentBranch || 'main',
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/pull', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          remote,
          branch,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await refreshStatus();
        await getCommitHistory();
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

  const push = async (remote = 'origin', branch?: string, force = false) => {
    const _operation = 'push';
    const operationId = Date.now().toString();

    dispatch({
      type: 'ADD_OPERATION',
      operation: {
        id: operationId,
        type: 'push',
        status: 'pending',
        branch: branch || state.currentBranch || 'main',
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const response = await apiCall('/git/push', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          remote,
          branch,
          force,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_OPERATION',
          id: operationId,
          updates: { status: 'completed', completedAt: new Date().toISOString() },
        });
        await refreshStatus();
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

  // History and Information
  const getCommitHistory = async (limit = 20, branch?: string) => {
    const _operation = 'getCommitHistory';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<MCPGitCommit[]>('/git/log', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          maxCount: limit,
          branch,
        }),
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_COMMITS', commits: response.data });
      }
    } catch (error) {
      handleError(_operation, error as Error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const getCommitDiff = async (commitHash: string): Promise<string | null> => {
    const _operation = 'getCommitDiff';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<{ diff: string }>('/git/show', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          revision: commitHash,
        }),
      });

      if (response.success && response.data) {
        return response.data.diff;
      }
      return null;
    } catch (error) {
      handleError(_operation, error as Error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const getBranchList = async (includeRemotes = false) => {
    const _operation = 'getBranchList';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<string[]>('/git/branch', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          branchType: includeRemotes ? 'all' : 'local',
        }),
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_BRANCHES', branches: response.data });
      }
    } catch (error) {
      handleError(_operation, error as Error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  // Workflow Integration
  const setWorkflowContext = (context: { caseId?: string; userId?: string; workflowId?: string }) => {
    dispatch({ type: 'SET_WORKFLOW_CONTEXT', context });
  };

  const createWorkflowCommit = async (message: string, files: string[], metadata?: any): Promise<string> => {
    // Add files first
    await addFiles(files);
    
    // Create structured commit message with workflow context
    const workflowMessage = [
      message,
      '',
      ...(metadata ? [
        'Workflow Context:',
        ...Object.entries(metadata).map(([key, value]) => `${key}: ${value}`),
        '',
      ] : []),
      'Generated with Solicitor Brain MCP Integration',
    ].join('\n');

    return await commit(
      workflowMessage,
      state.workflowContext.workflowId,
      state.workflowContext.caseId
    );
  };

  const tagCommit = async (commitHash: string, tagName: string, message?: string) => {
    const _operation = 'tagCommit';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall('/git/tag', {
        method: 'POST',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          commitHash,
          tagName,
          message,
        }),
      });

      if (!response.success) {
        throw new Error('Failed to create tag');
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  // Automation
  const enableAutoCommit = (enabled: boolean) => {
    dispatch({ type: 'SET_AUTO_COMMIT', autoCommit: enabled });
    
    if (!enabled && autoCommitIntervalRef.current) {
      clearInterval(autoCommitIntervalRef.current);
      autoCommitIntervalRef.current = null;
    }
  };

  const scheduleAutoCommit = (intervalMinutes: number) => {
    if (autoCommitIntervalRef.current) {
      clearInterval(autoCommitIntervalRef.current);
    }

    autoCommitIntervalRef.current = setInterval(async () => {
      if (state.status && (state.status.staged.length > 0 || state.status.unstaged.length > 0)) {
        try {
          // Stage all changes
          if (state.status.unstaged.length > 0) {
            await addFiles(state.status.unstaged);
          }
          
          // Create auto-commit
          const timestamp = new Date().toLocaleString();
          await commit(`Auto-commit: ${timestamp}`, state.workflowContext.workflowId);
        } catch (error) {
          console.error('Auto-commit failed:', error);
        }
      }
    }, intervalMinutes * 60 * 1000);
  };

  // Real-time Updates
  const connect = async () => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${DEFAULT_MCP_CONFIG.websocketUrl}/git`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        dispatch({ type: 'SET_CONNECTED', connected: true });
        ws.send(JSON.stringify({
          type: 'auth',
          token,
          userId: user?.id,
          repositoryPath: state.repositoryPath,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'git_status_update':
              dispatch({ type: 'SET_STATUS', status: message.data });
              break;
            
            case 'git_operation_complete': {
              const { operationId, result } = message.data;
              dispatch({
                type: 'UPDATE_OPERATION',
                id: operationId,
                updates: {
                  status: 'completed',
                  completedAt: new Date().toISOString(),
                  hash: result?.hash,
                },
              });
              break;
            }
            
            case 'new_commit':
              dispatch({ type: 'ADD_COMMIT', commit: message.data });
              break;
            
            case 'branch_update':
              dispatch({ type: 'SET_BRANCHES', branches: message.data.branches });
              dispatch({ type: 'SET_CURRENT_BRANCH', branch: message.data.currentBranch });
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

  // Utility Functions
  const validateRepository = async (): Promise<boolean> => {
    if (!state.repositoryPath) return false;

    try {
      const response = await apiCall<{ valid: boolean }>('/git/validate', {
        method: 'POST',
        body: JSON.stringify({ repoPath: state.repositoryPath }),
      });

      return response.success && response.data?.valid === true;
    } catch {
      return false;
    }
  };

  const getGitIgnoreRules = async (): Promise<string[]> => {
    const _operation = 'getGitIgnoreRules';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall<{ rules: string[] }>('/git/gitignore', {
        method: 'GET',
        body: JSON.stringify({ repoPath: state.repositoryPath }),
      });

      if (response.success && response.data) {
        return response.data.rules;
      }
      return [];
    } catch (error) {
      handleError(_operation, error as Error);
      return [];
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const updateGitIgnore = async (rules: string[]) => {
    const _operation = 'updateGitIgnore';
    dispatch({ type: 'SET_LOADING', operation: _operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation: _operation, error: null });

    try {
      const response = await apiCall('/git/gitignore', {
        method: 'PUT',
        body: JSON.stringify({
          repoPath: state.repositoryPath,
          rules,
        }),
      });

      if (!response.success) {
        throw new Error('Failed to update .gitignore');
      }
    } catch (error) {
      handleError(_operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: _operation, loading: false });
    }
  };

  const clearErrors = (operation?: string) => {
    if (operation) {
      dispatch({ type: 'SET_ERROR', operation: _operation, error: null });
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
      case 'commit':
        if (operation.message) {
          await commit(operation.message, state.workflowContext.workflowId, state.workflowContext.caseId);
        }
        break;
      case 'push':
        await push('origin', operation.branch);
        break;
      case 'pull':
        await pull('origin', operation.branch);
        break;
      default:
        console.warn(`Retry not implemented for operation type: ${operation.type}`);
    }
  };

  // Effects
  useEffect(() => {
    if (token && user) {
      // Set default workflow context
      setWorkflowContext({ userId: user.id });
      
      if (DEFAULT_MCP_CONFIG.enableRealtime) {
        connect();
      }
    }

    return () => {
      disconnect();
      if (autoCommitIntervalRef.current) {
        clearInterval(autoCommitIntervalRef.current);
      }
    };
  }, [token, user]);

  // Context value
  const contextValue: MCPGitContextType = {
    ...state,
    initRepository,
    setRepository,
    refreshStatus,
    addFiles,
    unstageFiles,
    restoreFiles,
    commit,
    amendCommit,
    resetCommit,
    createBranch,
    switchBranch,
    deleteBranch,
    mergeBranch,
    addRemote,
    removeRemote,
    fetch,
    pull,
    push,
    getCommitHistory,
    getCommitDiff,
    getBranchList,
    setWorkflowContext,
    createWorkflowCommit,
    tagCommit,
    enableAutoCommit,
    scheduleAutoCommit,
    connect,
    disconnect,
    validateRepository,
    getGitIgnoreRules,
    updateGitIgnore,
    clearErrors,
    retry,
  };

  return (
    <MCPGitContext.Provider value={contextValue}>
      {children}
    </MCPGitContext.Provider>
  );
}

// Hook
export function useMCPGit(options: MCPHookOptions = {}) {
  const context = useContext(MCPGitContext);
  if (!context) {
    throw new Error('useMCPGit must be used within an MCPGitProvider');
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
        context.refreshStatus();
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, pollInterval, context]);

  return context;
}