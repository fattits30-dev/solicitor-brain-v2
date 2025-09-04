/**
 * MCP Workflow Context Manager
 * 
 * Provides React context for legal workflow management including:
 * - Legal document processing workflows
 * - AI-powered analysis and generation
 * - Case management workflow orchestration
 * - Step-by-step workflow execution with real-time updates
 * - Integration with memory, file, and git contexts
 */

import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  MCPWorkflow,
  MCPWorkflowStep,
  MCPAIOperation,
  LegalWorkflowContext,
  LegalDocument,
  MCPApiResponse,
  MCPLoadingState,
  MCPErrorState,
  MCPHookOptions,
  DEFAULT_MCP_CONFIG,
} from '../types/mcp';

// Context State Interface
interface MCPWorkflowContextState {
  // Workflow state
  workflows: MCPWorkflow[];
  activeWorkflow: MCPWorkflow | null;
  workflowTemplates: {
    id: string;
    name: string;
    description: string;
    type: string;
    steps: Partial<MCPWorkflowStep>[];
  }[];
  
  // AI Operations
  aiOperations: MCPAIOperation[];
  activeAIOperations: MCPAIOperation[];
  
  // Legal context
  legalContext: LegalWorkflowContext | null;
  documents: LegalDocument[];
  
  // Execution state
  executionQueue: string[]; // workflow IDs
  pausedWorkflows: string[];
  scheduledWorkflows: {
    workflowId: string;
    scheduledAt: string;
    recurring?: string; // cron expression
  }[];
  
  // State management
  loading: MCPLoadingState;
  errors: MCPErrorState;
  connected: boolean;
  lastUpdate: string | null;
}

// Action Types
type MCPWorkflowAction =
  | { type: 'SET_LOADING'; operation: string; loading: boolean }
  | { type: 'SET_ERROR'; operation: string; error: string | null }
  | { type: 'SET_WORKFLOWS'; workflows: MCPWorkflow[] }
  | { type: 'ADD_WORKFLOW'; workflow: MCPWorkflow }
  | { type: 'UPDATE_WORKFLOW'; id: string; updates: Partial<MCPWorkflow> }
  | { type: 'REMOVE_WORKFLOW'; id: string }
  | { type: 'SET_ACTIVE_WORKFLOW'; workflow: MCPWorkflow | null }
  | { type: 'UPDATE_WORKFLOW_STEP'; workflowId: string; stepId: string; updates: Partial<MCPWorkflowStep> }
  | { type: 'ADD_AI_OPERATION'; operation: MCPAIOperation }
  | { type: 'UPDATE_AI_OPERATION'; id: string; updates: Partial<MCPAIOperation> }
  | { type: 'REMOVE_AI_OPERATION'; id: string }
  | { type: 'SET_LEGAL_CONTEXT'; context: LegalWorkflowContext | null }
  | { type: 'SET_DOCUMENTS'; documents: LegalDocument[] }
  | { type: 'ADD_DOCUMENT'; document: LegalDocument }
  | { type: 'UPDATE_DOCUMENT'; id: string; updates: Partial<LegalDocument> }
  | { type: 'SET_WORKFLOW_TEMPLATES'; templates: any[] }
  | { type: 'SET_EXECUTION_QUEUE'; queue: string[] }
  | { type: 'SET_PAUSED_WORKFLOWS'; paused: string[] }
  | { type: 'SET_SCHEDULED_WORKFLOWS'; scheduled: any[] }
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'SET_LAST_UPDATE'; timestamp: string };

// Context Interface
interface MCPWorkflowContextType extends MCPWorkflowContextState {
  // Workflow Management
  createWorkflow: (template: any, context: LegalWorkflowContext) => Promise<string>;
  duplicateWorkflow: (workflowId: string, newName?: string) => Promise<string>;
  deleteWorkflow: (workflowId: string) => Promise<void>;
  getWorkflow: (workflowId: string) => Promise<MCPWorkflow | null>;
  updateWorkflowMetadata: (workflowId: string, metadata: any) => Promise<void>;
  
  // Workflow Execution
  startWorkflow: (workflowId: string) => Promise<void>;
  pauseWorkflow: (workflowId: string) => Promise<void>;
  resumeWorkflow: (workflowId: string) => Promise<void>;
  cancelWorkflow: (workflowId: string) => Promise<void>;
  restartWorkflow: (workflowId: string, fromStep?: string) => Promise<void>;
  
  // Step Management
  executeStep: (workflowId: string, stepId: string) => Promise<void>;
  skipStep: (workflowId: string, stepId: string, reason?: string) => Promise<void>;
  retryStep: (workflowId: string, stepId: string) => Promise<void>;
  updateStepInputs: (workflowId: string, stepId: string, inputs: any) => Promise<void>;
  
  // AI Operations
  startAIOperation: (operation: Omit<MCPAIOperation, 'id' | 'status' | 'startedAt'>) => Promise<string>;
  cancelAIOperation: (operationId: string) => Promise<void>;
  getAIOperationResult: (operationId: string) => Promise<any>;
  
  // Document Processing
  processDocument: (documentId: string, operations: string[]) => Promise<void>;
  analyzeDocument: (documentId: string, analysisType: string) => Promise<any>;
  generateFromTemplate: (templateId: string, context: any) => Promise<string>;
  extractDocumentData: (documentId: string, schema: any) => Promise<any>;
  
  // Legal Workflow Helpers
  startContractReview: (documentId: string, reviewType: 'basic' | 'comprehensive') => Promise<string>;
  startCaseAnalysis: (caseId: string, analysisScope: string[]) => Promise<string>;
  startDocumentDrafting: (templateType: string, context: any) => Promise<string>;
  startComplianceCheck: (documentIds: string[], regulations: string[]) => Promise<string>;
  
  // Scheduling and Automation
  scheduleWorkflow: (workflowId: string, scheduledAt: string, recurring?: string) => Promise<void>;
  unscheduleWorkflow: (workflowId: string) => Promise<void>;
  enableWorkflowAutomation: (workflowId: string, triggers: any[]) => Promise<void>;
  
  // Context Management
  setLegalContext: (context: LegalWorkflowContext) => void;
  updateLegalContext: (updates: Partial<LegalWorkflowContext>) => void;
  clearLegalContext: () => void;
  
  // Templates
  getWorkflowTemplates: () => Promise<void>;
  createWorkflowTemplate: (template: any) => Promise<string>;
  updateWorkflowTemplate: (templateId: string, updates: any) => Promise<void>;
  deleteWorkflowTemplate: (templateId: string) => Promise<void>;
  
  // Integration
  connectToMemory: () => Promise<void>;
  connectToFiles: () => Promise<void>;
  connectToGit: () => Promise<void>;
  
  // Real-time Updates
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Utility Functions
  exportWorkflow: (workflowId: string, format?: 'json' | 'yaml') => Promise<any>;
  importWorkflow: (data: any) => Promise<string>;
  validateWorkflow: (workflow: MCPWorkflow) => Promise<{ valid: boolean; errors: string[] }>;
  clearErrors: (operation?: string) => void;
  retry: (operationId: string) => Promise<void>;
}

// Initial State
const initialState: MCPWorkflowContextState = {
  workflows: [],
  activeWorkflow: null,
  workflowTemplates: [],
  aiOperations: [],
  activeAIOperations: [],
  legalContext: null,
  documents: [],
  executionQueue: [],
  pausedWorkflows: [],
  scheduledWorkflows: [],
  loading: {},
  errors: {},
  connected: false,
  lastUpdate: null,
};

// Reducer
function mcpWorkflowReducer(state: MCPWorkflowContextState, action: MCPWorkflowAction): MCPWorkflowContextState {
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
    
    case 'SET_WORKFLOWS':
      return {
        ...state,
        workflows: action.workflows,
        lastUpdate: new Date().toISOString(),
      };
    
    case 'ADD_WORKFLOW':
      return {
        ...state,
        workflows: [action.workflow, ...state.workflows],
        lastUpdate: new Date().toISOString(),
      };
    
    case 'UPDATE_WORKFLOW':
      return {
        ...state,
        workflows: state.workflows.map(w =>
          w.id === action.id ? { ...w, ...action.updates } : w
        ),
        activeWorkflow: state.activeWorkflow?.id === action.id
          ? { ...state.activeWorkflow, ...action.updates }
          : state.activeWorkflow,
        lastUpdate: new Date().toISOString(),
      };
    
    case 'REMOVE_WORKFLOW':
      return {
        ...state,
        workflows: state.workflows.filter(w => w.id !== action.id),
        activeWorkflow: state.activeWorkflow?.id === action.id ? null : state.activeWorkflow,
        lastUpdate: new Date().toISOString(),
      };
    
    case 'SET_ACTIVE_WORKFLOW':
      return { ...state, activeWorkflow: action.workflow };
    
    case 'UPDATE_WORKFLOW_STEP':
      return {
        ...state,
        workflows: state.workflows.map(w =>
          w.id === action.workflowId
            ? {
                ...w,
                steps: w.steps.map(s =>
                  s.id === action.stepId ? { ...s, ...action.updates } : s
                ),
              }
            : w
        ),
        activeWorkflow: state.activeWorkflow?.id === action.workflowId
          ? {
              ...state.activeWorkflow,
              steps: state.activeWorkflow.steps.map(s =>
                s.id === action.stepId ? { ...s, ...action.updates } : s
              ),
            }
          : state.activeWorkflow,
        lastUpdate: new Date().toISOString(),
      };
    
    case 'ADD_AI_OPERATION':
      return {
        ...state,
        aiOperations: [action.operation, ...state.aiOperations],
        activeAIOperations: action.operation.status === 'in_progress'
          ? [action.operation, ...state.activeAIOperations]
          : state.activeAIOperations,
      };
    
    case 'UPDATE_AI_OPERATION':
      return {
        ...state,
        aiOperations: state.aiOperations.map(op =>
          op.id === action.id ? { ...op, ...action.updates } : op
        ),
        activeAIOperations: state.activeAIOperations.map(op =>
          op.id === action.id ? { ...op, ...action.updates } : op
        ).filter(op => op.status === 'in_progress'),
      };
    
    case 'REMOVE_AI_OPERATION':
      return {
        ...state,
        aiOperations: state.aiOperations.filter(op => op.id !== action.id),
        activeAIOperations: state.activeAIOperations.filter(op => op.id !== action.id),
      };
    
    case 'SET_LEGAL_CONTEXT':
      return { ...state, legalContext: action.context };
    
    case 'SET_DOCUMENTS':
      return { ...state, documents: action.documents };
    
    case 'ADD_DOCUMENT':
      return {
        ...state,
        documents: [action.document, ...state.documents],
      };
    
    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.map(d =>
          d.id === action.id ? { ...d, ...action.updates } : d
        ),
      };
    
    case 'SET_WORKFLOW_TEMPLATES':
      return { ...state, workflowTemplates: action.templates };
    
    case 'SET_EXECUTION_QUEUE':
      return { ...state, executionQueue: action.queue };
    
    case 'SET_PAUSED_WORKFLOWS':
      return { ...state, pausedWorkflows: action.paused };
    
    case 'SET_SCHEDULED_WORKFLOWS':
      return { ...state, scheduledWorkflows: action.scheduled };
    
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };
    
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdate: action.timestamp };
    
    default:
      return state;
  }
}

// Context Creation
const MCPWorkflowContext = createContext<MCPWorkflowContextType | undefined>(undefined);

// Provider Component
export function MCPWorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mcpWorkflowReducer, initialState);
  const { token, user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const executionIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Workflow Management
  const createWorkflow = async (template: any, context: LegalWorkflowContext): Promise<string> => {
    const operation = 'createWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<{ workflowId: string }>('/workflow/create', {
        method: 'POST',
        body: JSON.stringify({
          template,
          context,
          userId: user?.id,
        }),
      });

      if (response.success && response.data) {
        // Fetch the newly created workflow
        const newWorkflow = await getWorkflow(response.data.workflowId);
        if (newWorkflow) {
          dispatch({ type: 'ADD_WORKFLOW', workflow: newWorkflow });
        }
        return response.data.workflowId;
      }

      throw new Error('Failed to create workflow');
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const duplicateWorkflow = async (workflowId: string, newName?: string): Promise<string> => {
    const operation = 'duplicateWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<{ workflowId: string }>('/workflow/duplicate', {
        method: 'POST',
        body: JSON.stringify({
          workflowId,
          newName,
          userId: user?.id,
        }),
      });

      if (response.success && response.data) {
        const newWorkflow = await getWorkflow(response.data.workflowId);
        if (newWorkflow) {
          dispatch({ type: 'ADD_WORKFLOW', workflow: newWorkflow });
        }
        return response.data.workflowId;
      }

      throw new Error('Failed to duplicate workflow');
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    const operation = 'deleteWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/delete', {
        method: 'DELETE',
        body: JSON.stringify({ workflowId }),
      });

      if (response.success) {
        dispatch({ type: 'REMOVE_WORKFLOW', id: workflowId });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const getWorkflow = async (workflowId: string): Promise<MCPWorkflow | null> => {
    const operation = 'getWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPWorkflow>('/workflow/get', {
        method: 'POST',
        body: JSON.stringify({ workflowId }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error as Error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const updateWorkflowMetadata = async (workflowId: string, metadata: any) => {
    const operation = 'updateWorkflowMetadata';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/update-metadata', {
        method: 'PATCH',
        body: JSON.stringify({ workflowId, metadata }),
      });

      if (response.success) {
        dispatch({ type: 'UPDATE_WORKFLOW', id: workflowId, updates: { metadata } });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Workflow Execution
  const startWorkflow = async (workflowId: string) => {
    const operation = 'startWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/start', {
        method: 'POST',
        body: JSON.stringify({ workflowId }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          id: workflowId,
          updates: {
            status: 'running',
            startedAt: new Date().toISOString(),
          },
        });
        
        // Add to execution queue
        dispatch({
          type: 'SET_EXECUTION_QUEUE',
          queue: [...state.executionQueue, workflowId],
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const pauseWorkflow = async (workflowId: string) => {
    const operation = 'pauseWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/pause', {
        method: 'POST',
        body: JSON.stringify({ workflowId }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          id: workflowId,
          updates: { status: 'paused' },
        });
        dispatch({
          type: 'SET_PAUSED_WORKFLOWS',
          paused: [...state.pausedWorkflows, workflowId],
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const resumeWorkflow = async (workflowId: string) => {
    const operation = 'resumeWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/resume', {
        method: 'POST',
        body: JSON.stringify({ workflowId }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          id: workflowId,
          updates: { status: 'running' },
        });
        dispatch({
          type: 'SET_PAUSED_WORKFLOWS',
          paused: state.pausedWorkflows.filter(id => id !== workflowId),
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const cancelWorkflow = async (workflowId: string) => {
    const operation = 'cancelWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/cancel', {
        method: 'POST',
        body: JSON.stringify({ workflowId }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          id: workflowId,
          updates: { status: 'failed', completedAt: new Date().toISOString() },
        });
        dispatch({
          type: 'SET_EXECUTION_QUEUE',
          queue: state.executionQueue.filter(id => id !== workflowId),
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const restartWorkflow = async (workflowId: string, fromStep?: string) => {
    const operation = 'restartWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/restart', {
        method: 'POST',
        body: JSON.stringify({ workflowId, fromStep }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          id: workflowId,
          updates: {
            status: 'running',
            startedAt: new Date().toISOString(),
            completedAt: undefined,
          },
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Step Management
  const executeStep = async (workflowId: string, stepId: string) => {
    const operation = 'executeStep';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/execute-step', {
        method: 'POST',
        body: JSON.stringify({ workflowId, stepId }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW_STEP',
          workflowId,
          stepId,
          updates: {
            status: 'in_progress',
            startedAt: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const skipStep = async (workflowId: string, stepId: string, reason?: string) => {
    const operation = 'skipStep';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/skip-step', {
        method: 'POST',
        body: JSON.stringify({ workflowId, stepId, reason }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW_STEP',
          workflowId,
          stepId,
          updates: {
            status: 'skipped',
            completedAt: new Date().toISOString(),
            outputs: { skipped: true, reason },
          },
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const retryStep = async (workflowId: string, stepId: string) => {
    const operation = 'retryStep';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/retry-step', {
        method: 'POST',
        body: JSON.stringify({ workflowId, stepId }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW_STEP',
          workflowId,
          stepId,
          updates: {
            status: 'pending',
            error: undefined,
            startedAt: undefined,
            completedAt: undefined,
          },
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const updateStepInputs = async (workflowId: string, stepId: string, inputs: any) => {
    const operation = 'updateStepInputs';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/update-step-inputs', {
        method: 'PATCH',
        body: JSON.stringify({ workflowId, stepId, inputs }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW_STEP',
          workflowId,
          stepId,
          updates: { inputs },
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // AI Operations
  const startAIOperation = async (operation: Omit<MCPAIOperation, 'id' | 'status' | 'startedAt'>): Promise<string> => {
    const op = 'startAIOperation';
    dispatch({ type: 'SET_LOADING', operation: op, loading: true });
    dispatch({ type: 'SET_ERROR', operation: op, error: null });

    try {
      const response = await apiCall<{ operationId: string }>('/workflow/ai/start', {
        method: 'POST',
        body: JSON.stringify(operation),
      });

      if (response.success && response.data) {
        const aiOperation: MCPAIOperation = {
          ...operation,
          id: response.data.operationId,
          status: 'pending',
          startedAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_AI_OPERATION', operation: aiOperation });
        return response.data.operationId;
      }

      throw new Error('Failed to start AI operation');
    } catch (error) {
      handleError(op, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation: op, loading: false });
    }
  };

  const cancelAIOperation = async (operationId: string) => {
    const operation = 'cancelAIOperation';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/ai/cancel', {
        method: 'POST',
        body: JSON.stringify({ operationId }),
      });

      if (response.success) {
        dispatch({ type: 'REMOVE_AI_OPERATION', id: operationId });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const getAIOperationResult = async (operationId: string): Promise<any> => {
    const operation = 'getAIOperationResult';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/workflow/ai/result', {
        method: 'POST',
        body: JSON.stringify({ operationId }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error as Error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Document Processing
  const processDocument = async (documentId: string, operations: string[]) => {
    const operation = 'processDocument';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/document/process', {
        method: 'POST',
        body: JSON.stringify({
          documentId,
          operations,
          userId: user?.id,
        }),
      });

      if (response.success) {
        // Update document status
        dispatch({
          type: 'UPDATE_DOCUMENT',
          id: documentId,
          updates: { status: 'under_review' },
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const analyzeDocument = async (documentId: string, analysisType: string): Promise<any> => {
    const operation = 'analyzeDocument';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/workflow/document/analyze', {
        method: 'POST',
        body: JSON.stringify({
          documentId,
          analysisType,
          userId: user?.id,
        }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error as Error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const generateFromTemplate = async (templateId: string, context: any): Promise<string> => {
    const operation = 'generateFromTemplate';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<{ documentId: string }>('/workflow/document/generate', {
        method: 'POST',
        body: JSON.stringify({
          templateId,
          context,
          userId: user?.id,
        }),
      });

      if (response.success && response.data) {
        return response.data.documentId;
      }

      throw new Error('Failed to generate document');
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const extractDocumentData = async (documentId: string, schema: any): Promise<any> => {
    const operation = 'extractDocumentData';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/workflow/document/extract', {
        method: 'POST',
        body: JSON.stringify({
          documentId,
          schema,
          userId: user?.id,
        }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error as Error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Legal Workflow Helpers
  const startContractReview = async (documentId: string, reviewType: 'basic' | 'comprehensive'): Promise<string> => {
    const template = {
      name: `Contract Review - ${reviewType}`,
      type: 'contract_review',
      steps: reviewType === 'basic' ? [
        { name: 'Document Parsing', type: 'ai_operation' },
        { name: 'Basic Analysis', type: 'ai_operation' },
        { name: 'Risk Assessment', type: 'ai_operation' },
        { name: 'Generate Report', type: 'ai_operation' },
      ] : [
        { name: 'Document Parsing', type: 'ai_operation' },
        { name: 'Comprehensive Analysis', type: 'ai_operation' },
        { name: 'Risk Assessment', type: 'ai_operation' },
        { name: 'Compliance Check', type: 'ai_operation' },
        { name: 'Recommendation Generation', type: 'ai_operation' },
        { name: 'Generate Detailed Report', type: 'ai_operation' },
      ],
    };

    const context: LegalWorkflowContext = {
      caseId: state.legalContext?.caseId || '',
      documentIds: [documentId],
      workflowType: 'contract_review',
      confidentialityLevel: 'confidential',
    };

    return await createWorkflow(template, context);
  };

  const startCaseAnalysis = async (caseId: string, _analysisScope: string[]): Promise<string> => {
    const template = {
      name: 'Case Analysis',
      type: 'case_analysis',
      steps: [
        { name: 'Collect Case Documents', type: 'file_operation' },
        { name: 'Document Analysis', type: 'ai_operation' },
        { name: 'Timeline Construction', type: 'ai_operation' },
        { name: 'Legal Research', type: 'ai_operation' },
        { name: 'Strategy Recommendations', type: 'ai_operation' },
        { name: 'Generate Case Summary', type: 'ai_operation' },
      ],
    };

    const context: LegalWorkflowContext = {
      caseId,
      workflowType: 'case_analysis',
      confidentialityLevel: 'highly_confidential',
    };

    return await createWorkflow(template, context);
  };

  const startDocumentDrafting = async (templateType: string, context: any): Promise<string> => {
    const template = {
      name: `Document Drafting - ${templateType}`,
      type: 'document_drafting',
      steps: [
        { name: 'Template Selection', type: 'user_input' },
        { name: 'Context Validation', type: 'validation' },
        { name: 'Draft Generation', type: 'ai_operation' },
        { name: 'Legal Review', type: 'ai_operation' },
        { name: 'Finalization', type: 'ai_operation' },
      ],
    };

    const workflowContext: LegalWorkflowContext = {
      caseId: context.caseId || state.legalContext?.caseId || '',
      workflowType: 'document_drafting',
      confidentialityLevel: context.confidentialityLevel || 'confidential',
    };

    return await createWorkflow(template, workflowContext);
  };

  const startComplianceCheck = async (documentIds: string[], _regulations: string[]): Promise<string> => {
    const template = {
      name: 'Compliance Check',
      type: 'compliance_check',
      steps: [
        { name: 'Document Collection', type: 'file_operation' },
        { name: 'Regulation Analysis', type: 'ai_operation' },
        { name: 'Compliance Assessment', type: 'ai_operation' },
        { name: 'Gap Analysis', type: 'ai_operation' },
        { name: 'Remediation Recommendations', type: 'ai_operation' },
        { name: 'Generate Compliance Report', type: 'ai_operation' },
      ],
    };

    const context: LegalWorkflowContext = {
      caseId: state.legalContext?.caseId || '',
      documentIds,
      workflowType: 'compliance_check',
      confidentialityLevel: 'highly_confidential',
    };

    return await createWorkflow(template, context);
  };

  // Scheduling and Automation
  const scheduleWorkflow = async (workflowId: string, scheduledAt: string, recurring?: string) => {
    const operation = 'scheduleWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/schedule', {
        method: 'POST',
        body: JSON.stringify({
          workflowId,
          scheduledAt,
          recurring,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'SET_SCHEDULED_WORKFLOWS',
          scheduled: [
            ...state.scheduledWorkflows,
            { workflowId, scheduledAt, recurring },
          ],
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const unscheduleWorkflow = async (workflowId: string) => {
    const operation = 'unscheduleWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/unschedule', {
        method: 'DELETE',
        body: JSON.stringify({ workflowId }),
      });

      if (response.success) {
        dispatch({
          type: 'SET_SCHEDULED_WORKFLOWS',
          scheduled: state.scheduledWorkflows.filter(s => s.workflowId !== workflowId),
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const enableWorkflowAutomation = async (workflowId: string, triggers: any[]) => {
    const operation = 'enableWorkflowAutomation';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/automation', {
        method: 'POST',
        body: JSON.stringify({
          workflowId,
          triggers,
        }),
      });

      if (response.success) {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          id: workflowId,
          updates: {
            metadata: {
              ...state.workflows.find(w => w.id === workflowId)?.metadata,
              automation: { enabled: true, triggers },
            },
          },
        });
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Context Management
  const setLegalContext = (context: LegalWorkflowContext) => {
    dispatch({ type: 'SET_LEGAL_CONTEXT', context });
  };

  const updateLegalContext = (updates: Partial<LegalWorkflowContext>) => {
    if (state.legalContext) {
      dispatch({
        type: 'SET_LEGAL_CONTEXT',
        context: { ...state.legalContext, ...updates },
      });
    }
  };

  const clearLegalContext = () => {
    dispatch({ type: 'SET_LEGAL_CONTEXT', context: null });
  };

  // Templates
  const getWorkflowTemplates = async () => {
    const operation = 'getWorkflowTemplates';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any[]>('/workflow/templates', {
        method: 'GET',
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_WORKFLOW_TEMPLATES', templates: response.data });
      }
    } catch (error) {
      handleError(operation, error as Error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const createWorkflowTemplate = async (template: any): Promise<string> => {
    const operation = 'createWorkflowTemplate';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<{ templateId: string }>('/workflow/templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });

      if (response.success && response.data) {
        await getWorkflowTemplates(); // Refresh templates
        return response.data.templateId;
      }

      throw new Error('Failed to create workflow template');
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const updateWorkflowTemplate = async (templateId: string, updates: any) => {
    const operation = 'updateWorkflowTemplate';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/templates', {
        method: 'PATCH',
        body: JSON.stringify({ templateId, ...updates }),
      });

      if (response.success) {
        await getWorkflowTemplates(); // Refresh templates
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const deleteWorkflowTemplate = async (templateId: string) => {
    const operation = 'deleteWorkflowTemplate';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/workflow/templates', {
        method: 'DELETE',
        body: JSON.stringify({ templateId }),
      });

      if (response.success) {
        await getWorkflowTemplates(); // Refresh templates
      }
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Integration placeholder methods
  const connectToMemory = async () => {
    // Integration with MCP Memory Context
    console.log('Connecting workflow to memory context...');
  };

  const connectToFiles = async () => {
    // Integration with MCP File Operations Context
    console.log('Connecting workflow to file operations context...');
  };

  const connectToGit = async () => {
    // Integration with MCP Git Context
    console.log('Connecting workflow to git context...');
  };

  // Real-time Updates
  const connect = async () => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${DEFAULT_MCP_CONFIG.websocketUrl}/workflow`;
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
            case 'workflow_update':
              dispatch({
                type: 'UPDATE_WORKFLOW',
                id: message.data.workflowId,
                updates: message.data.updates,
              });
              break;
            
            case 'step_update':
              dispatch({
                type: 'UPDATE_WORKFLOW_STEP',
                workflowId: message.data.workflowId,
                stepId: message.data.stepId,
                updates: message.data.updates,
              });
              break;
            
            case 'ai_operation_update':
              dispatch({
                type: 'UPDATE_AI_OPERATION',
                id: message.data.operationId,
                updates: message.data.updates,
              });
              break;
            
            case 'workflow_completed':
              dispatch({
                type: 'UPDATE_WORKFLOW',
                id: message.data.workflowId,
                updates: {
                  status: 'completed',
                  completedAt: new Date().toISOString(),
                  progress: 100,
                },
              });
              dispatch({
                type: 'SET_EXECUTION_QUEUE',
                queue: state.executionQueue.filter(id => id !== message.data.workflowId),
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

  // Utility Functions
  const exportWorkflow = async (workflowId: string, format: 'json' | 'yaml' = 'json'): Promise<any> => {
    const operation = 'exportWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/workflow/export', {
        method: 'POST',
        body: JSON.stringify({ workflowId, format }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error as Error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const importWorkflow = async (data: any): Promise<string> => {
    const operation = 'importWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<{ workflowId: string }>('/workflow/import', {
        method: 'POST',
        body: JSON.stringify({ data }),
      });

      if (response.success && response.data) {
        const newWorkflow = await getWorkflow(response.data.workflowId);
        if (newWorkflow) {
          dispatch({ type: 'ADD_WORKFLOW', workflow: newWorkflow });
        }
        return response.data.workflowId;
      }

      throw new Error('Failed to import workflow');
    } catch (error) {
      handleError(operation, error as Error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const validateWorkflow = async (workflow: MCPWorkflow): Promise<{ valid: boolean; errors: string[] }> => {
    const operation = 'validateWorkflow';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<{ valid: boolean; errors: string[] }>('/workflow/validate', {
        method: 'POST',
        body: JSON.stringify({ workflow }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return { valid: false, errors: ['Validation failed'] };
    } catch (error) {
      handleError(operation, error as Error);
      return { valid: false, errors: [error instanceof Error ? error.message : String(error)] };
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
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
    // Find and retry the failed operation
    const aiOperation = state.aiOperations.find(op => op.id === operationId);
    if (aiOperation && aiOperation.status === 'failed') {
      await startAIOperation({
        type: aiOperation.type,
        model: aiOperation.model,
        prompt: aiOperation.prompt,
        caseId: aiOperation.caseId,
        documentId: aiOperation.documentId,
      });
    }
  };

  // Effects
  useEffect(() => {
    if (token && user) {
      getWorkflowTemplates();
      if (DEFAULT_MCP_CONFIG.enableRealtime) {
        connect();
      }
    }

    return () => {
      disconnect();
      if (executionIntervalRef.current) {
        clearInterval(executionIntervalRef.current);
      }
    };
  }, [token, user]);

  // Context value
  const contextValue: MCPWorkflowContextType = {
    ...state,
    createWorkflow,
    duplicateWorkflow,
    deleteWorkflow,
    getWorkflow,
    updateWorkflowMetadata,
    startWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    cancelWorkflow,
    restartWorkflow,
    executeStep,
    skipStep,
    retryStep,
    updateStepInputs,
    startAIOperation,
    cancelAIOperation,
    getAIOperationResult,
    processDocument,
    analyzeDocument,
    generateFromTemplate,
    extractDocumentData,
    startContractReview,
    startCaseAnalysis,
    startDocumentDrafting,
    startComplianceCheck,
    scheduleWorkflow,
    unscheduleWorkflow,
    enableWorkflowAutomation,
    setLegalContext,
    updateLegalContext,
    clearLegalContext,
    getWorkflowTemplates,
    createWorkflowTemplate,
    updateWorkflowTemplate,
    deleteWorkflowTemplate,
    connectToMemory,
    connectToFiles,
    connectToGit,
    connect,
    disconnect,
    exportWorkflow,
    importWorkflow,
    validateWorkflow,
    clearErrors,
    retry,
  };

  return (
    <MCPWorkflowContext.Provider value={contextValue}>
      {children}
    </MCPWorkflowContext.Provider>
  );
}

// Hook
export function useMCPWorkflow(options: MCPHookOptions = {}) {
  const context = useContext(MCPWorkflowContext);
  if (!context) {
    throw new Error('useMCPWorkflow must be used within an MCPWorkflowProvider');
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
    if (autoRefresh && pollInterval && context.workflows.length > 0) {
      const interval = setInterval(() => {
        // Refresh active workflows
        context.workflows
          .filter(w => w.status === 'running')
          .forEach(w => {
            context.getWorkflow(w.id);
          });
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, pollInterval, context]);

  return context;
}