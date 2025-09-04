/**
 * MCP Test Helper Utilities
 * 
 * Helper functions for testing MCP integration in E2E and integration tests:
 * - MCP service mocking and setup
 * - WebSocket connection testing
 * - Context initialization verification
 * - Real-time update simulation
 * - Performance monitoring utilities
 */

import { Page, expect } from '@playwright/test';

// MCP initialization timeout
export const MCP_INIT_TIMEOUT = 10000;

// Test data generators
export const generateTestMemoryItem = (index: number = 0) => ({
  key: `test-item-${index}-${Date.now()}`,
  value: `Test memory item ${index} for automated testing`,
  category: ['task', 'note', 'decision'][index % 3] as 'task' | 'note' | 'decision',
  priority: ['high', 'normal', 'low'][index % 3] as 'high' | 'normal' | 'low',
  channel: 'test-channel',
});

export const generateTestWorkflow = (type: string = 'contract_review') => ({
  name: `Test Workflow - ${type} - ${Date.now()}`,
  type,
  description: `Automated test workflow for ${type}`,
  steps: [
    {
      name: 'Document Analysis',
      type: 'ai_operation',
      description: 'Analyze uploaded document',
    },
    {
      name: 'Generate Report',
      type: 'ai_operation',
      description: 'Generate analysis report',
    },
  ],
});

/**
 * Wait for MCP contexts to initialize properly
 */
export async function waitForMCPInitialization(page: Page, timeout: number = MCP_INIT_TIMEOUT): Promise<void> {
  console.log('Waiting for MCP initialization...');

  // Wait for MCP provider to be initialized
  await page.waitForFunction(
    () => {
      return (window as any).mcpProvider?.isInitialized === true;
    },
    { timeout }
  );

  // Wait for individual contexts to be ready
  await page.waitForFunction(
    () => {
      const mcp = (window as any);
      return (
        mcp.mcpMemory?.status?.enabled &&
        mcp.mcpFiles?.connected &&
        mcp.mcpGit?.connected &&
        mcp.mcpWorkflow?.connected &&
        mcp.mcpSystem?.connected
      );
    },
    { timeout }
  );

  // Verify MCP components are visible
  await page.waitForSelector('[data-testid="mcp-status-indicator"]', { timeout });
  await expect(page.locator('[data-testid="mcp-status-indicator"]')).toContainText('Ready');

  console.log('MCP initialization complete');
}

/**
 * Mock MCP services for testing
 */
export async function mockMCPServices(page: Page): Promise<void> {
  console.log('Setting up MCP service mocks...');

  // Mock memory service
  await page.route('**/api/mcp/memory/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/status') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            enabled: true,
            connected: true,
            sessionCount: 1,
            itemCount: 0,
            channels: ['default', 'test-channel'],
          },
        }),
      });
    } else if (url.includes('/get') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    } else if (url.includes('/save') && method === 'POST') {
      const requestBody = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...requestBody,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock file operations service
  await page.route('**/api/mcp/files/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/list') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    } else if (url.includes('/upload') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              path: '/test-uploads/uploaded-file.pdf',
              name: 'uploaded-file.pdf',
              size: 1024,
              type: 'file',
              lastModified: new Date().toISOString(),
            },
          ],
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock git service
  await page.route('**/api/mcp/git/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/status') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            clean: true,
            ahead: 0,
            behind: 0,
            staged: [],
            unstaged: [],
            untracked: [],
            branch: 'main',
          },
        }),
      });
    } else if ((url.includes('/add') || url.includes('/commit')) && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            hash: 'mock-commit-hash',
            message: 'Mock commit',
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock workflow service
  await page.route('**/api/mcp/workflow/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/templates') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'contract-review',
              name: 'Contract Review',
              type: 'document_processing',
              description: 'Review contract documents',
            },
            {
              id: 'compliance-check',
              name: 'Compliance Check',
              type: 'legal_research',
              description: 'Check compliance requirements',
            },
          ],
        }),
      });
    } else if (url.includes('/create') && method === 'POST') {
      const requestBody = await route.request().postDataJSON();
      const workflowId = `workflow-${Date.now()}`;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: workflowId,
            ...requestBody,
            status: 'draft',
            progress: 0,
            createdAt: new Date().toISOString(),
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock system health service
  await page.route('**/api/mcp/system/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/health') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            overall: 'healthy',
            services: [
              { name: 'memory', status: 'healthy', responseTime: 50 },
              { name: 'files', status: 'healthy', responseTime: 30 },
              { name: 'git', status: 'healthy', responseTime: 40 },
              { name: 'workflow', status: 'healthy', responseTime: 60 },
            ],
            lastUpdate: new Date().toISOString(),
            uptime: 123456,
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  console.log('MCP service mocks configured');
}

/**
 * Verify MCP real-time connections are established
 */
export async function verifyMCPRealTimeConnections(page: Page): Promise<void> {
  console.log('Verifying MCP real-time connections...');

  // Check WebSocket connections are established
  const wsConnections = await page.evaluate(() => {
    return (window as any).mcpWebSockets?.length || 0;
  });

  expect(wsConnections).toBeGreaterThan(0);

  // Verify connection status indicators
  await expect(page.locator('[data-testid="mcp-realtime-status"]')).toContainText('Connected');

  console.log(`${wsConnections} WebSocket connections verified`);
}

/**
 * Simulate real-time update from another user/session
 */
export async function simulateRealTimeUpdate(
  page: Page, 
  updateType: 'memory' | 'file' | 'git' | 'workflow',
  updateData: any
): Promise<void> {
  console.log(`Simulating ${updateType} real-time update...`);

  await page.evaluate(({ type, data }) => {
    const mockUpdate = {
      type,
      action: 'create',
      id: `mock-${Date.now()}`,
      data,
      timestamp: new Date().toISOString(),
    };

    // Simulate WebSocket message
    const event = new MessageEvent('message', {
      data: JSON.stringify(mockUpdate),
    });

    // Dispatch to MCP WebSocket handlers
    (window as any).mcpWebSockets?.forEach((ws: any) => {
      if (ws.onmessage) {
        ws.onmessage(event);
      }
    });
  }, { type: updateType, data: updateData });

  console.log(`${updateType} update simulated`);
}

/**
 * Monitor MCP performance metrics
 */
export async function monitorMCPPerformance(page: Page): Promise<{
  responseTime: number;
  memoryUsage: number;
  errorCount: number;
}> {
  console.log('Monitoring MCP performance...');

  const metrics = await page.evaluate(() => {
    const performance = (window as any).mcpPerformance || {};
    return {
      responseTime: performance.averageResponseTime || 0,
      memoryUsage: performance.memoryUsage || 0,
      errorCount: performance.errorCount || 0,
    };
  });

  console.log('Performance metrics:', metrics);
  return metrics;
}

/**
 * Inject MCP test utilities into page context
 */
export async function injectMCPTestUtilities(page: Page): Promise<void> {
  console.log('Injecting MCP test utilities...');

  await page.addInitScript(() => {
    // Global test utilities
    (window as any).mcpTestUtils = {
      // Create test data
      createTestMemoryItem: (index: number = 0) => ({
        key: `test-item-${index}-${Date.now()}`,
        value: `Test memory item ${index}`,
        category: ['task', 'note', 'decision'][index % 3],
        priority: ['high', 'normal', 'low'][index % 3],
      }),

      // Performance monitoring
      startPerformanceMonitor: () => {
        (window as any).mcpPerformance = {
          startTime: Date.now(),
          requestCount: 0,
          totalResponseTime: 0,
          errorCount: 0,
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        };

        // Monitor fetch requests
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          const startTime = Date.now();
          const perf = (window as any).mcpPerformance;
          perf.requestCount++;

          try {
            const response = await originalFetch(...args);
            const responseTime = Date.now() - startTime;
            perf.totalResponseTime += responseTime;
            perf.averageResponseTime = perf.totalResponseTime / perf.requestCount;
            return response;
          } catch (error) {
            perf.errorCount++;
            throw error;
          }
        };
      },

      // Mock WebSocket for testing
      mockWebSocket: () => {
        (window as any).mcpWebSockets = [];
        
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = class MockWebSocket extends OriginalWebSocket {
          constructor(url: string, protocols?: string | string[]) {
            super(url, protocols);
            (window as any).mcpWebSockets.push(this);
          }
        } as any;
      },

      // Clear all test data
      clearTestData: async () => {
        const mcp = (window as any);
        if (mcp.mcpMemory?.clearErrors) {
          mcp.mcpMemory.clearErrors();
        }
        if (mcp.mcpFiles?.clearErrors) {
          mcp.mcpFiles.clearErrors();
        }
        if (mcp.mcpGit?.clearErrors) {
          mcp.mcpGit.clearErrors();
        }
        if (mcp.mcpWorkflow?.clearErrors) {
          mcp.mcpWorkflow.clearErrors();
        }
      },
    };

    // Auto-start performance monitoring
    (window as any).mcpTestUtils.startPerformanceMonitor();
    (window as any).mcpTestUtils.mockWebSocket();
  });

  console.log('MCP test utilities injected');
}