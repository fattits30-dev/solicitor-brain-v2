/**
 * Convenience Hooks for MCP Integration
 * 
 * Provides easy-to-use React hooks for consuming all MCP contexts with:
 * - Combined context access
 * - Simplified API interfaces
 * - Common patterns and utilities
 * - Type-safe operations
 */

import { useCallback, useEffect as _useEffect, useMemo, useState } from 'react';
import { useMCPMemory } from '../contexts/MCPMemoryContext';
import { useMCPFileOperations } from '../contexts/MCPFileOperationsContext';
import { useMCPGit } from '../contexts/MCPGitContext';
import { useMCPWorkflow } from '../contexts/MCPWorkflowContext';
import { useMCPSystemStatus } from '../contexts/MCPSystemStatusContext';
import { useMCPProvider } from '../contexts/MCPProvider';

// Re-export individual context hooks for direct usage
export { useMCPMemory, useMCPFileOperations, useMCPGit, useMCPWorkflow, useMCPSystemStatus, useMCPProvider };
import {
  MCPContextItem,
  MCPFileInfo,
  MCPGitStatus,
  MCPWorkflow,
  MCPSystemHealth,
  MCPHookOptions,
  LegalWorkflowContext,
} from '../types/mcp';

// Re-export types for convenient usage
export type {
  MCPContextItem,
  MCPFileInfo,
  MCPGitStatus,
  MCPWorkflow,
  MCPSystemHealth,
  MCPHookOptions,
  LegalWorkflowContext,
};

// Combined MCP Integration Hook
export function useMCPIntegration(options: MCPHookOptions = {}) {
  const memory = useMCPMemory(options);
  const files = useMCPFileOperations(options);
  const git = useMCPGit(options);
  const workflow = useMCPWorkflow(options);
  const system = useMCPSystemStatus(options);

  // Combined loading state
  const isLoading = useMemo(() => {
    return (
      Object.values(memory.loading).some(Boolean) ||
      Object.values(files.loading).some(Boolean) ||
      Object.values(git.loading).some(Boolean) ||
      Object.values(workflow.loading).some(Boolean) ||
      Object.values(system.loading).some(Boolean)
    );
  }, [memory.loading, files.loading, git.loading, workflow.loading, system.loading]);

  // Combined error state
  const hasErrors = useMemo(() => {
    return (
      Object.values(memory.errors).some(Boolean) ||
      Object.values(files.errors).some(Boolean) ||
      Object.values(git.errors).some(Boolean) ||
      Object.values(workflow.errors).some(Boolean) ||
      Object.values(system.errors).some(Boolean)
    );
  }, [memory.errors, files.errors, git.errors, workflow.errors, system.errors]);

  // Combined connectivity state
  const isConnected = useMemo(() => {
    return memory.connected && files.connected && git.connected && workflow.connected && system.connected;
  }, [memory.connected, files.connected, git.connected, workflow.connected, system.connected]);

  // Health summary
  const healthSummary = useMemo(() => {
    return {
      overall: system.systemHealth.overall,
      services: {
        memory: memory.status.enabled && memory.connected ? 'healthy' : 'degraded',
        files: files.connected ? 'healthy' : 'degraded',
        git: git.repositoryPath && git.connected ? 'healthy' : 'degraded',
        workflow: workflow.connected ? 'healthy' : 'degraded',
        system: system.connected ? 'healthy' : 'degraded',
      },
      lastUpdate: system.systemHealth.lastUpdate,
    };
  }, [memory, files, git, workflow, system]);

  return {
    // Individual contexts
    memory,
    files,
    git,
    workflow,
    system,

    // Combined states
    isLoading,
    hasErrors,
    isConnected,
    healthSummary,

    // Utility functions
    connectAll: useCallback(async () => {
      await Promise.all([
        memory.connect(),
        files.connect(),
        git.connect(),
        workflow.connect(),
        system.connect(),
      ]);
    }, [memory, files, git, workflow, system]),

    disconnectAll: useCallback(() => {
      memory.disconnect();
      files.disconnect();
      git.disconnect();
      workflow.disconnect();
      system.disconnect();
    }, [memory, files, git, workflow, system]),

    clearAllErrors: useCallback(() => {
      memory.clearErrors();
      files.clearErrors();
      git.clearErrors();
      workflow.clearErrors();
      system.clearErrors();
    }, [memory, files, git, workflow, system]),
  };
}

// Memory Operations Hook
export function useMCPMemoryOperations() {
  const memory = useMCPMemory();

  return {
    // Quick access to common operations
    saveNote: useCallback(async (key: string, content: string, category = 'note' as const) => {
      return memory.save({
        key,
        value: content,
        category,
        priority: 'normal',
      });
    }, [memory]),

    saveTask: useCallback(async (key: string, content: string, priority = 'normal' as const) => {
      return memory.save({
        key,
        value: content,
        category: 'task',
        priority,
      });
    }, [memory]),

    saveDecision: useCallback(async (key: string, content: string) => {
      return memory.save({
        key,
        value: content,
        category: 'decision',
        priority: 'high',
      });
    }, [memory]),

    quickSearch: useCallback(async (query: string) => {
      return memory.search({
        query,
        limit: 10,
        sort: 'created_desc',
      });
    }, [memory]),

    getRecentItems: useCallback(async (limit = 20) => {
      return memory.getAll({
        limit,
        sort: 'created_desc',
      });
    }, [memory]),

    ...memory,
  };
}

// File Operations Hook
export function useMCPFileOperationsWithProgress() {
  const files = useMCPFileOperations();
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const uploadWithProgress = useCallback(async (fileList: FileList, targetPath?: string) => {
    const uploads = Array.from(fileList).map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
    }));

    // Initialize progress tracking
    uploads.forEach(({ id }) => {
      setUploadProgress(prev => ({ ...prev, [id]: 0 }));
    });

    try {
      await files.uploadFiles(fileList, targetPath);
      
      // Mark all as complete
      uploads.forEach(({ id }) => {
        setUploadProgress(prev => ({ ...prev, [id]: 100 }));
      });
    } catch (error) {
      // Mark all as failed
      uploads.forEach(({ id }) => {
        setUploadProgress(prev => ({ ...prev, [id]: -1 }));
      });
      throw error;
    }
  }, [files]);

  return {
    ...files,
    uploadWithProgress,
    uploadProgress,

    // Convenience methods
    createFile: useCallback(async (path: string, content: string) => {
      return files.writeFile(path, content);
    }, [files]),

    createFolder: useCallback(async (path: string) => {
      return files.createDirectory(path);
    }, [files]),

    quickSearch: useCallback(async (query: string, currentDir?: string) => {
      return files.searchFiles(query, currentDir || files.currentDirectory);
    }, [files]),

    selectMultiple: useCallback((paths: string[]) => {
      paths.forEach(path => files.selectFile(path));
    }, [files]),
  };
}

// Git Operations Hook
export function useMCPGitOperations() {
  const git = useMCPGit();

  const quickCommit = useCallback(async (message: string, files?: string[]) => {
    if (files && files.length > 0) {
      await git.addFiles(files);
    }
    return git.commit(message);
  }, [git]);

  const smartCommit = useCallback(async (
    message: string,
    options: {
      addAll?: boolean;
      files?: string[];
      workflowId?: string;
      caseId?: string;
    } = {}
  ) => {
    const { addAll, files, workflowId, caseId } = options;

    if (addAll && git.status) {
      await git.addFiles([...git.status.unstaged, ...git.status.untracked]);
    } else if (files) {
      await git.addFiles(files);
    }

    return git.commit(message, workflowId, caseId);
  }, [git]);

  const syncWithRemote = useCallback(async (remote = 'origin', branch?: string) => {
    await git.pull(remote, branch);
    await git.push(remote, branch);
  }, [git]);

  return {
    ...git,
    quickCommit,
    smartCommit,
    syncWithRemote,

    // Status helpers
    hasUncommittedChanges: useMemo(() => {
      return git.status ? (git.status.staged.length + git.status.unstaged.length > 0) : false;
    }, [git.status]),

    hasUntrackedFiles: useMemo(() => {
      return git.status ? git.status.untracked.length > 0 : false;
    }, [git.status]),

    isClean: useMemo(() => {
      return git.status ? git.status.clean : false;
    }, [git.status]),
  };
}

// Workflow Operations Hook
export function useMCPWorkflowOperations() {
  const workflow = useMCPWorkflow();

  const createLegalWorkflow = useCallback(async (
    type: 'contract_review' | 'case_analysis' | 'document_drafting' | 'compliance_check',
    context: LegalWorkflowContext,
    customSteps?: any[]
  ) => {
    const templates = {
      contract_review: {
        name: 'Contract Review Workflow',
        type: 'contract_review',
        steps: customSteps || [
          { name: 'Document Parsing', type: 'ai_operation' },
          { name: 'Legal Analysis', type: 'ai_operation' },
          { name: 'Risk Assessment', type: 'ai_operation' },
          { name: 'Report Generation', type: 'ai_operation' },
        ],
      },
      case_analysis: {
        name: 'Case Analysis Workflow',
        type: 'case_analysis',
        steps: customSteps || [
          { name: 'Document Collection', type: 'file_operation' },
          { name: 'Case Analysis', type: 'ai_operation' },
          { name: 'Timeline Construction', type: 'ai_operation' },
          { name: 'Strategy Recommendations', type: 'ai_operation' },
        ],
      },
      document_drafting: {
        name: 'Document Drafting Workflow',
        type: 'document_drafting',
        steps: customSteps || [
          { name: 'Template Selection', type: 'user_input' },
          { name: 'Content Generation', type: 'ai_operation' },
          { name: 'Legal Review', type: 'validation' },
          { name: 'Finalization', type: 'ai_operation' },
        ],
      },
      compliance_check: {
        name: 'Compliance Check Workflow',
        type: 'compliance_check',
        steps: customSteps || [
          { name: 'Document Collection', type: 'file_operation' },
          { name: 'Regulation Analysis', type: 'ai_operation' },
          { name: 'Compliance Assessment', type: 'ai_operation' },
          { name: 'Remediation Plan', type: 'ai_operation' },
        ],
      },
    };

    return workflow.createWorkflow(templates[type], context);
  }, [workflow]);

  const runAIAnalysis = useCallback(async (
    type: 'summary' | 'analysis' | 'extraction' | 'classification',
    documentId: string,
    prompt?: string
  ) => {
    return workflow.startAIOperation({
      type,
      documentId,
      prompt,
    });
  }, [workflow]);

  return {
    ...workflow,
    createLegalWorkflow,
    runAIAnalysis,

    // Status helpers
    activeWorkflowCount: useMemo(() => {
      return workflow.workflows.filter(w => w.status === 'running').length;
    }, [workflow.workflows]),

    completedWorkflowCount: useMemo(() => {
      return workflow.workflows.filter(w => w.status === 'completed').length;
    }, [workflow.workflows]),

    failedWorkflowCount: useMemo(() => {
      return workflow.workflows.filter(w => w.status === 'failed').length;
    }, [workflow.workflows]),
  };
}

// System Monitoring Hook
export function useMCPSystemMonitoring() {
  const system = useMCPSystemStatus();

  const getServiceByName = useCallback((name: string) => {
    return system.services.find(s => s.name === name);
  }, [system.services]);

  const getServicesByType = useCallback((type: string) => {
    return system.services.filter(s => s.type === type);
  }, [system.services]);

  const getUnhealthyServices = useCallback(() => {
    return system.services.filter(s => s.status !== 'healthy');
  }, [system.services]);

  const getCriticalAlerts = useCallback(() => {
    return system.alerts.filter(a => a.severity === 'critical' && !a.acknowledged);
  }, [system.alerts]);

  return {
    ...system,
    getServiceByName,
    getServicesByType,
    getUnhealthyServices,
    getCriticalAlerts,

    // Status helpers
    healthScore: useMemo(() => {
      if (system.services.length === 0) return 0;
      const healthyCount = system.services.filter(s => s.status === 'healthy').length;
      return Math.round((healthyCount / system.services.length) * 100);
    }, [system.services]),

    criticalAlertCount: useMemo(() => {
      return system.alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
    }, [system.alerts]),

    avgResponseTime: useMemo(() => {
      const services = system.services.filter(s => s.responseTime);
      if (services.length === 0) return 0;
      const totalTime = services.reduce((sum, s) => sum + (s.responseTime || 0), 0);
      return Math.round(totalTime / services.length);
    }, [system.services]),
  };
}

// Combined Legal Operations Hook
export function useLegalOperations() {
  const memory = useMCPMemoryOperations();
  const files = useMCPFileOperations();
  const git = useMCPGitOperations();
  const workflow = useMCPWorkflowOperations();

  const startCaseWork = useCallback(async (caseId: string) => {
    // Set legal context
    workflow.setLegalContext({
      caseId,
      workflowType: 'contract_review',
      confidentialityLevel: 'confidential',
    });

    // Create memory session for case
    await memory.startSession(`Case-${caseId}`, `Legal work for case ${caseId}`);

    // Save initial case context
    await memory.saveTask(
      `case-${caseId}-start`,
      `Started legal work for case ${caseId}`,
      'normal'
    );

    return caseId;
  }, [memory, workflow]);

  const completeCaseWork = useCallback(async (caseId: string, summary: string) => {
    // Save completion summary
    await memory.saveDecision(
      `case-${caseId}-complete`,
      summary
    );

    // Commit all case work
    if (git.hasUncommittedChanges) {
      await git.smartCommit(
        `Complete legal work for case ${caseId}`,
        {
          addAll: true,
          caseId,
        }
      );
    }

    // Clear legal context
    workflow.clearLegalContext();

    return true;
  }, [memory, git, workflow]);

  const processLegalDocument = useCallback(async (
    documentPath: string,
    analysisType: 'contract_review' | 'compliance_check' | 'risk_assessment' = 'contract_review'
  ) => {
    // Save document processing start
    await memory.saveNote(
      `doc-process-${Date.now()}`,
      `Processing document: ${documentPath}`,
      'note'
    );

    // Create appropriate workflow - map risk_assessment to case_analysis
    const mappedWorkflowType: 'contract_review' | 'case_analysis' | 'document_drafting' | 'compliance_check' = 
      analysisType === 'risk_assessment' ? 'case_analysis' : analysisType as 'contract_review' | 'compliance_check';
    
    const workflowId = await workflow.createLegalWorkflow(
      mappedWorkflowType,
      {
        caseId: workflow.legalContext?.caseId || '',
        documentIds: [documentPath],
        workflowType: mappedWorkflowType,
        confidentialityLevel: 'confidential',
      }
    );

    // Start workflow
    await workflow.startWorkflow(workflowId);

    return workflowId;
  }, [memory, workflow]);

  return {
    startCaseWork,
    completeCaseWork,
    processLegalDocument,

    // Quick access to individual operations
    memory,
    files,
    git,
    workflow,
  };
}

// Development and Testing Hook
export function useMCPDevelopment() {
  const integration = useMCPIntegration();
  const [devMode, setDevMode] = useState(false);

  const runHealthChecks = useCallback(async () => {
    const results = {
      memory: await integration.memory.refreshStatus(),
      files: await integration.files.refreshDirectory(),
      git: await integration.git.refreshStatus(),
      workflow: await integration.workflow.getWorkflowTemplates(),
      system: await integration.system.performHealthCheck(),
    };
    
    console.log('Health Check Results:', results);
    return results;
  }, [integration]);

  const seedTestData = useCallback(async () => {
    if (!devMode) {
      console.warn('Dev mode not enabled. Call enableDevMode() first.');
      return;
    }

    // Seed memory with test data
    await integration.memory.batchSave([
      { key: 'test-task-1', value: 'Complete contract review', category: 'task', priority: 'high' },
      { key: 'test-task-2', value: 'Update compliance documentation', category: 'task', priority: 'normal' },
      { key: 'test-decision-1', value: 'Approved contract terms', category: 'decision', priority: 'high' },
    ]);

    console.log('Test data seeded');
  }, [integration, devMode]);

  const clearTestData = useCallback(async () => {
    if (!devMode) {
      console.warn('Dev mode not enabled. Call enableDevMode() first.');
      return;
    }

    // Clear test data
    const testKeys = ['test-task-1', 'test-task-2', 'test-decision-1'];
    for (const key of testKeys) {
      await integration.memory.remove(key);
    }

    console.log('Test data cleared');
  }, [integration, devMode]);

  const enableDevMode = useCallback(() => {
    setDevMode(true);
    console.log('MCP Development mode enabled');
  }, []);

  const disableDevMode = useCallback(() => {
    setDevMode(false);
    console.log('MCP Development mode disabled');
  }, []);

  return {
    devMode,
    enableDevMode,
    disableDevMode,
    runHealthChecks,
    seedTestData,
    clearTestData,
    integration,
  };
}