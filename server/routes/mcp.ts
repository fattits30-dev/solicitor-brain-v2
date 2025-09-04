/**
 * MCP API Routes
 * 
 * Handles all MCP (Model Context Protocol) integration endpoints including:
 * - Memory-keeper operations
 * - File operations via MCP filesystem
 * - Git operations via MCP git tools
 * - Workflow management and orchestration
 * - System health and monitoring
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { logDataModification, logError } from '../middleware/audit.js';
import { mcpMemoryKeeper } from '../services/mcp-client.js';
import { structuredLogger as _structuredLogger } from '../services/structured-logger.js';
import type { 
  MCPContextItem, 
  MCPSearchOptions,
  MCPFileInfo,
  MCPGitStatus,
  MCPWorkflow,
  MCPSystemHealth,
  MCPServiceStatus,
} from '../types/mcp.js';

const router = Router();

// Apply authentication to all MCP routes
router.use(authenticate);

// ========================================
// MEMORY-KEEPER ROUTES
// ========================================

// Save context item
router.post('/memory/save', async (req, res) => {
  try {
    const { key, value, category, priority, channel, private: isPrivate } = req.body;
    
    const item: MCPContextItem = {
      key,
      value,
      category: category || 'note',
      priority: priority || 'normal',
      channel: channel || 'default',
      private: isPrivate || false,
      sessionId: req.user?.id,
    };

    const success = await mcpMemoryKeeper.save(item);
    
    if (success) {
      await logDataModification(req, 'memory_save', { key, category }, req.user!);
      
      res.json({
        success: true,
        data: {
          ...item,
          createdAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      throw new Error('Failed to save to memory-keeper');
    }
  } catch (error) {
    await logError(req, 'mcp_memory_save', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to save memory item',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get context items
router.post('/memory/get', async (req, res) => {
  try {
    const { key, category: _category, channel: _channel, sessionId: _sessionId, includeMetadata: _includeMetadata } = req.body;
    
    const items = await mcpMemoryKeeper.get(key);
    
    res.json({
      success: true,
      data: items || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_memory_get', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve memory items',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Search context items
router.post('/memory/search', async (req, res) => {
  try {
    const options: MCPSearchOptions = req.body;
    
    const results = await mcpMemoryKeeper.search(options);
    
    res.json({
      success: true,
      data: results || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_memory_search', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to search memory items',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Update context item
router.patch('/memory/update', async (req, res) => {
  try {
    const { key, ...updates } = req.body;
    
    // For now, we'll implement this as delete and re-save
    // In a full implementation, this would use the MCP update operation
    const existingItems = await mcpMemoryKeeper.get(key);
    if (existingItems && existingItems.length > 0) {
      const existingItem = existingItems[0];
      const updatedItem: MCPContextItem = {
        ...existingItem,
        ...updates,
        key,
      };
      
      const success = await mcpMemoryKeeper.save(updatedItem);
      
      if (success) {
        await logDataModification(req, 'memory_update', { key, updates }, req.user!);
        
        res.json({
          success: true,
          data: {
            ...updatedItem,
            updatedAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        throw new Error('Failed to update memory item');
      }
    } else {
      res.status(404).json({
        success: false,
        error: 'Memory item not found',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    await logError(req, 'mcp_memory_update', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to update memory item',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete context items
router.delete('/memory/delete', async (req, res) => {
  try {
    const { keys } = req.body;
    
    // For each key, we would call MCP delete operation
    // For now, we'll simulate the operation
    await logDataModification(req, 'memory_delete', { keys }, req.user!);
    
    res.json({
      success: true,
      data: { deletedKeys: keys },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_memory_delete', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to delete memory items',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Batch save context items
router.post('/memory/batch-save', async (req, res) => {
  try {
    const { items } = req.body;
    const savedItems: MCPContextItem[] = [];
    
    for (const item of items) {
      const contextItem: MCPContextItem = {
        ...item,
        sessionId: item.sessionId || req.user?.id,
      };
      
      const success = await mcpMemoryKeeper.save(contextItem);
      if (success) {
        savedItems.push({
          ...contextItem,
          createdAt: new Date().toISOString(),
        });
      }
    }
    
    await logDataModification(req, 'memory_batch_save', { count: savedItems.length }, req.user!);
    
    res.json({
      success: true,
      data: savedItems,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_memory_batch_save', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to batch save memory items',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Memory status
router.get('/memory/status', async (req, res) => {
  try {
    const status = await mcpMemoryKeeper.getStatus();
    
    res.json({
      success: true,
      data: {
        ...status,
        connected: true,
        lastUpdate: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_memory_status', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to get memory status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ========================================
// FILE OPERATIONS ROUTES
// ========================================

// List directory contents
router.post('/files/list', async (req, res) => {
  try {
    const { path } = req.body;
    
    // Mock file listing - in real implementation, use MCP filesystem tools
    const mockFiles: MCPFileInfo[] = [
      {
        path: `${path}/contracts`,
        name: 'contracts',
        size: 0,
        type: 'directory',
        lastModified: new Date().toISOString(),
      },
      {
        path: `${path}/case-documents`,
        name: 'case-documents',
        size: 0,
        type: 'directory',
        lastModified: new Date().toISOString(),
      },
      {
        path: `${path}/example.pdf`,
        name: 'example.pdf',
        size: 1024000,
        type: 'file',
        lastModified: new Date().toISOString(),
      },
    ];
    
    res.json({
      success: true,
      data: mockFiles,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_files_list', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to list directory',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Read file content
router.post('/files/read', async (req, res) => {
  try {
    const { path } = req.body;
    
    // Mock file reading - in real implementation, use MCP filesystem tools
    const content = `// Mock file content for ${path}\nexport const data = "sample";`;
    
    res.json({
      success: true,
      data: { content },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_files_read', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to read file',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Write file content
router.post('/files/write', async (req, res) => {
  try {
    const { path, content } = req.body;
    
    // Mock file writing - in real implementation, use MCP filesystem tools
    await logDataModification(req, 'file_write', { path, size: content.length }, req.user!);
    
    res.json({
      success: true,
      data: { path, size: content.length },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_files_write', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to write file',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ========================================
// GIT OPERATIONS ROUTES
// ========================================

// Get git status
router.post('/git/status', async (req, res) => {
  try {
    const { repoPath: _repoPath } = req.body;
    
    // Mock git status - in real implementation, use MCP git tools
    const status: MCPGitStatus = {
      clean: false,
      ahead: 0,
      behind: 0,
      staged: ['src/components/NewComponent.tsx'],
      unstaged: ['src/utils/helpers.ts'],
      untracked: ['temp-file.txt'],
      branch: 'feature/mcp-integration',
      remoteUrl: 'https://github.com/example/solicitor-brain-v2.git',
    };
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_git_status', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to get git status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Add files to git
router.post('/git/add', async (req, res) => {
  try {
    const { repoPath, files } = req.body;
    
    // Mock git add - in real implementation, use MCP git tools
    await logDataModification(req, 'git_add', { repoPath, files }, req.user!);
    
    res.json({
      success: true,
      data: { addedFiles: files },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_git_add', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to add files to git',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Commit changes
router.post('/git/commit', async (req, res) => {
  try {
    const { repoPath, message, workflowId, caseId, userId: _userId } = req.body;
    
    // Mock git commit - in real implementation, use MCP git tools
    const hash = `commit-${Date.now().toString(36)}`;
    
    await logDataModification(req, 'git_commit', {
      repoPath,
      message,
      hash,
      workflowId,
      caseId,
    }, req.user!);
    
    res.json({
      success: true,
      data: { hash },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_git_commit', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to commit changes',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ========================================
// WORKFLOW ROUTES
// ========================================

// Create workflow
router.post('/workflow/create', async (req, res) => {
  try {
    const { template, context, userId } = req.body;
    
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Mock workflow creation - in real implementation, use workflow engine
    const _workflow: Partial<MCPWorkflow> = {
      id: workflowId,
      name: template.name || 'New Workflow',
      description: template.description || '',
      type: template.type || 'custom',
      status: 'draft',
      steps: template.steps?.map((step: any, index: number) => ({
        id: `step-${index}`,
        name: step.name,
        description: step.description || '',
        type: step.type,
        status: 'pending',
        dependencies: step.dependencies || [],
        inputs: step.inputs || {},
        outputs: {},
      })) || [],
      userId,
      metadata: { context },
      createdAt: new Date().toISOString(),
      progress: 0,
    };
    
    await logDataModification(req, 'workflow_create', { workflowId, type: template.type }, req.user!);
    
    res.json({
      success: true,
      data: { workflowId },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_workflow_create', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to create workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Start workflow
router.post('/workflow/start', async (req, res) => {
  try {
    const { workflowId } = req.body;
    
    // Mock workflow start - in real implementation, use workflow engine
    await logDataModification(req, 'workflow_start', { workflowId }, req.user!);
    
    res.json({
      success: true,
      data: { workflowId, status: 'running' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_workflow_start', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to start workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ========================================
// SYSTEM HEALTH ROUTES
// ========================================

// System health check
router.get('/system/health', async (req, res) => {
  try {
    // Mock system health - in real implementation, check actual services
    const services: MCPServiceStatus[] = [
      {
        name: 'MCP Memory Keeper',
        type: 'mcp_tool',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        responseTime: 45,
      },
      {
        name: 'MCP File Operations',
        type: 'mcp_tool',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        responseTime: 32,
      },
      {
        name: 'PostgreSQL Database',
        type: 'database',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        responseTime: 12,
      },
      {
        name: 'Redis Cache',
        type: 'database',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        responseTime: 5,
      },
    ];
    
    const systemHealth: MCPSystemHealth = {
      overall: 'healthy',
      services,
      lastUpdate: new Date().toISOString(),
      uptime: process.uptime(),
    };
    
    res.json({
      success: true,
      data: systemHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_system_health', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to get system health',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Individual service health check
router.post('/system/service-health', async (req, res) => {
  try {
    const { serviceId } = req.body;
    
    // Mock service health check - in real implementation, check specific service
    const serviceStatus: MCPServiceStatus = {
      name: serviceId,
      type: 'mcp_tool',
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      responseTime: Math.floor(Math.random() * 100) + 10,
    };
    
    res.json({
      success: true,
      data: serviceStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_service_health', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// System metrics
router.post('/system/metrics', async (req, res) => {
  try {
    const { timeRange } = req.body;
    
    // Mock system metrics - in real implementation, collect actual metrics
    const metrics = {
      totalRequests: 1500,
      avgResponseTime: 125,
      errorRate: 0.02,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      timeRange,
    };
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_system_metrics', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ========================================
// GENERAL MCP ROUTES
// ========================================

// MCP status overview
router.get('/status', async (req, res) => {
  try {
    const status = {
      enabled: process.env.MCP_ENABLED === 'true',
      services: {
        memory: await mcpMemoryKeeper.getStatus(),
        files: { enabled: true, connected: true },
        git: { enabled: true, connected: true },
        workflow: { enabled: true, connected: true },
        system: { enabled: true, connected: true },
      },
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logError(req, 'mcp_status', error as Error, req.user!);
    res.status(500).json({
      success: false,
      error: 'Failed to get MCP status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;