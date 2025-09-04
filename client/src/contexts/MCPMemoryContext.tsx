/**
 * MCP Memory Context Manager
 * 
 * Provides React context for MCP Memory-Keeper integration including:
 * - Persistent state management across sessions
 * - Context item CRUD operations
 * - Advanced search and filtering
 * - Real-time memory updates
 * - Session management and branching
 */

import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  MCPContextItem,
  MCPSearchOptions,
  MCPMemoryStatus,
  MCPApiResponse,
  MCPLoadingState,
  MCPErrorState,
  MCPHookOptions,
  DEFAULT_MCP_CONFIG,
} from '../types/mcp';

// Context State Interface
interface MCPMemoryContextState {
  // Core state
  items: MCPContextItem[];
  status: MCPMemoryStatus;
  currentSession: string | null;
  loading: MCPLoadingState;
  errors: MCPErrorState;
  
  // Search and filtering
  searchResults: MCPContextItem[];
  searchQuery: string;
  activeFilters: MCPSearchOptions;
  
  // Real-time updates
  connected: boolean;
  lastUpdate: string | null;
  pendingUpdates: number;
}

// Action Types
type MCPMemoryAction =
  | { type: 'SET_LOADING'; operation: string; loading: boolean }
  | { type: 'SET_ERROR'; operation: string; error: string | null }
  | { type: 'SET_ITEMS'; items: MCPContextItem[] }
  | { type: 'ADD_ITEM'; item: MCPContextItem }
  | { type: 'UPDATE_ITEM'; key: string; item: Partial<MCPContextItem> }
  | { type: 'REMOVE_ITEM'; key: string }
  | { type: 'SET_STATUS'; status: MCPMemoryStatus }
  | { type: 'SET_SEARCH_RESULTS'; results: MCPContextItem[]; query: string }
  | { type: 'SET_FILTERS'; filters: MCPSearchOptions }
  | { type: 'SET_SESSION'; sessionId: string | null }
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'SET_LAST_UPDATE'; timestamp: string };

// Context Interface
interface MCPMemoryContextType extends MCPMemoryContextState {
  // CRUD Operations
  save: (item: Omit<MCPContextItem, 'createdAt' | 'updatedAt'>) => Promise<void>;
  get: (key: string) => Promise<MCPContextItem | null>;
  getAll: (options?: MCPSearchOptions) => Promise<void>;
  update: (key: string, updates: Partial<MCPContextItem>) => Promise<void>;
  remove: (key: string) => Promise<void>;
  batchSave: (items: Omit<MCPContextItem, 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  
  // Search Operations
  search: (options: MCPSearchOptions) => Promise<void>;
  clearSearch: () => void;
  setFilters: (filters: MCPSearchOptions) => void;
  
  // Session Management
  startSession: (name?: string, description?: string) => Promise<void>;
  listSessions: () => Promise<any[]>;
  switchSession: (sessionId: string) => Promise<void>;
  branchSession: (branchName: string, copyDepth?: 'shallow' | 'deep') => Promise<void>;
  
  // Status and Health
  refreshStatus: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Utility Functions
  exportData: (format?: 'json' | 'inline') => Promise<any>;
  importData: (data: any, merge?: boolean) => Promise<void>;
  clearErrors: (operation?: string) => void;
  retry: (operation: string) => Promise<void>;
}

// Initial State
const initialState: MCPMemoryContextState = {
  items: [],
  status: {
    enabled: false,
    connected: false,
    sessionCount: 0,
    itemCount: 0,
    channels: [],
  },
  currentSession: null,
  loading: {},
  errors: {},
  searchResults: [],
  searchQuery: '',
  activeFilters: {},
  connected: false,
  lastUpdate: null,
  pendingUpdates: 0,
};

// Reducer
function mcpMemoryReducer(state: MCPMemoryContextState, action: MCPMemoryAction): MCPMemoryContextState {
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
    
    case 'SET_ITEMS':
      return {
        ...state,
        items: action.items,
        lastUpdate: new Date().toISOString(),
      };
    
    case 'ADD_ITEM':
      return {
        ...state,
        items: [action.item, ...state.items],
        lastUpdate: new Date().toISOString(),
      };
    
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.key === action.key ? { ...item, ...action.item } : item
        ),
        lastUpdate: new Date().toISOString(),
      };
    
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.key !== action.key),
        lastUpdate: new Date().toISOString(),
      };
    
    case 'SET_STATUS':
      return { ...state, status: action.status };
    
    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: action.results,
        searchQuery: action.query,
      };
    
    case 'SET_FILTERS':
      return { ...state, activeFilters: action.filters };
    
    case 'SET_SESSION':
      return { ...state, currentSession: action.sessionId };
    
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };
    
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdate: action.timestamp };
    
    default:
      return state;
  }
}

// Context Creation
const MCPMemoryContext = createContext<MCPMemoryContextType | undefined>(undefined);

// Provider Component
export function MCPMemoryProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mcpMemoryReducer, initialState);
  const { token, user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  };

  // Error Handler
  const handleError = (operation: string, error: any) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dispatch({ type: 'SET_ERROR', operation, error: errorMessage });
    dispatch({ type: 'SET_LOADING', operation, loading: false });
  };

  // CRUD Operations
  const save = async (item: Omit<MCPContextItem, 'createdAt' | 'updatedAt'>) => {
    const operation = 'save';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPContextItem>('/memory/save', {
        method: 'POST',
        body: JSON.stringify(item),
      });

      if (response.success && response.data) {
        dispatch({ type: 'ADD_ITEM', item: response.data });
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const get = async (key: string): Promise<MCPContextItem | null> => {
    const operation = 'get';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPContextItem[]>('/memory/get', {
        method: 'POST',
        body: JSON.stringify({ key }),
      });

      if (response.success && response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error) {
      handleError(operation, error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const getAll = async (options: MCPSearchOptions = {}) => {
    const operation = 'getAll';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPContextItem[]>('/memory/get', {
        method: 'POST',
        body: JSON.stringify(options),
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_ITEMS', items: response.data });
      }
    } catch (error) {
      handleError(operation, error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const update = async (key: string, updates: Partial<MCPContextItem>) => {
    const operation = 'update';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPContextItem>('/memory/update', {
        method: 'PATCH',
        body: JSON.stringify({ key, ...updates }),
      });

      if (response.success && response.data) {
        dispatch({ type: 'UPDATE_ITEM', key, item: response.data });
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const remove = async (key: string) => {
    const operation = 'remove';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/memory/delete', {
        method: 'DELETE',
        body: JSON.stringify({ keys: [key] }),
      });

      if (response.success) {
        dispatch({ type: 'REMOVE_ITEM', key });
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const batchSave = async (items: Omit<MCPContextItem, 'createdAt' | 'updatedAt'>[]) => {
    const operation = 'batchSave';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPContextItem[]>('/memory/batch-save', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });

      if (response.success && response.data) {
        response.data.forEach(item => {
          dispatch({ type: 'ADD_ITEM', item });
        });
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Search Operations
  const search = async (options: MCPSearchOptions) => {
    const operation = 'search';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPContextItem[]>('/memory/search', {
        method: 'POST',
        body: JSON.stringify(options),
      });

      if (response.success && response.data) {
        dispatch({
          type: 'SET_SEARCH_RESULTS',
          results: response.data,
          query: options.query || '',
        });
      }
    } catch (error) {
      handleError(operation, error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const clearSearch = () => {
    dispatch({ type: 'SET_SEARCH_RESULTS', results: [], query: '' });
    dispatch({ type: 'SET_FILTERS', filters: {} });
  };

  const setFilters = (filters: MCPSearchOptions) => {
    dispatch({ type: 'SET_FILTERS', filters });
  };

  // Session Management
  const startSession = async (name?: string, description?: string) => {
    const operation = 'startSession';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<{ sessionId: string }>('/memory/session/start', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_SESSION', sessionId: response.data.sessionId });
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const listSessions = async (): Promise<any[]> => {
    const operation = 'listSessions';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any[]>('/memory/session/list', {
        method: 'GET',
      });

      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      handleError(operation, error);
      return [];
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const switchSession = async (sessionId: string) => {
    const operation = 'switchSession';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/memory/session/switch', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });

      if (response.success) {
        dispatch({ type: 'SET_SESSION', sessionId });
        await getAll(); // Refresh items for new session
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const branchSession = async (branchName: string, copyDepth: 'shallow' | 'deep' = 'shallow') => {
    const operation = 'branchSession';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<{ sessionId: string }>('/memory/session/branch', {
        method: 'POST',
        body: JSON.stringify({ branchName, copyDepth }),
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_SESSION', sessionId: response.data.sessionId });
        await getAll(); // Refresh items for new session
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Status and Health
  const refreshStatus = async () => {
    const operation = 'refreshStatus';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPMemoryStatus>('/memory/status', {
        method: 'GET',
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_STATUS', status: response.data });
      }
    } catch (error) {
      handleError(operation, error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Real-time Connection
  const connect = async () => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${DEFAULT_MCP_CONFIG.websocketUrl}/memory`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        dispatch({ type: 'SET_CONNECTED', connected: true });
        setRetryCount(0);
        
        // Send authentication
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
            case 'update':
              if (message.data.action === 'create') {
                dispatch({ type: 'ADD_ITEM', item: message.data.item });
              } else if (message.data.action === 'update') {
                dispatch({ type: 'UPDATE_ITEM', key: message.data.key, item: message.data.item });
              } else if (message.data.action === 'delete') {
                dispatch({ type: 'REMOVE_ITEM', key: message.data.key });
              }
              break;
            
            case 'status':
              dispatch({ type: 'SET_STATUS', status: message.data });
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
        
        // Attempt reconnection with exponential backoff
        if (retryCount < DEFAULT_MCP_CONFIG.retryAttempts) {
          const delay = DEFAULT_MCP_CONFIG.retryDelay * Math.pow(2, retryCount);
          retryTimeoutRef.current = setTimeout(() => {
            setRetryCount(prev => prev + 1);
            connect();
          }, delay);
        }
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
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    dispatch({ type: 'SET_CONNECTED', connected: false });
  };

  // Utility Functions
  const exportData = async (format: 'json' | 'inline' = 'json'): Promise<any> => {
    const operation = 'export';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/memory/export', {
        method: 'POST',
        body: JSON.stringify({ format }),
      });

      if (response.success) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const importData = async (data: any, merge: boolean = false) => {
    const operation = 'import';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/memory/import', {
        method: 'POST',
        body: JSON.stringify({ data, merge }),
      });

      if (response.success) {
        await getAll(); // Refresh items after import
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const clearErrors = (operation?: string) => {
    if (operation) {
      dispatch({ type: 'SET_ERROR', operation, error: null });
    } else {
      dispatch({ type: 'SET_ERROR', operation: 'all', error: null });
    }
  };

  const retry = async (operation: string) => {
    // Implement retry logic for failed operations
    switch (operation) {
      case 'getAll':
        await getAll(state.activeFilters);
        break;
      case 'search':
        if (state.searchQuery) {
          await search({ query: state.searchQuery, ...state.activeFilters });
        }
        break;
      case 'refreshStatus':
        await refreshStatus();
        break;
      default:
        console.warn(`Retry not implemented for operation: ${operation}`);
    }
  };

  // Effects
  useEffect(() => {
    if (token && user) {
      refreshStatus();
      getAll();
      if (DEFAULT_MCP_CONFIG.enableRealtime) {
        connect();
      }
    }

    return () => {
      disconnect();
    };
  }, [token, user]);

  // Context value
  const contextValue: MCPMemoryContextType = {
    ...state,
    save,
    get,
    getAll,
    update,
    remove,
    batchSave,
    search,
    clearSearch,
    setFilters,
    startSession,
    listSessions,
    switchSession,
    branchSession,
    refreshStatus,
    connect,
    disconnect,
    exportData,
    importData,
    clearErrors,
    retry,
  };

  return (
    <MCPMemoryContext.Provider value={contextValue}>
      {children}
    </MCPMemoryContext.Provider>
  );
}

// Hook
export function useMCPMemory(options: MCPHookOptions = {}) {
  const context = useContext(MCPMemoryContext);
  if (!context) {
    throw new Error('useMCPMemory must be used within an MCPMemoryProvider');
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
        context.getAll();
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, pollInterval, context]);

  return context;
}