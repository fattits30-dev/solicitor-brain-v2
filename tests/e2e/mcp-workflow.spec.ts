/**
 * E2E Tests for Complete MCP Workflow
 * 
 * Tests the complete MCP integration workflow from frontend perspective:
 * - User authentication and MCP context initialization
 * - Complete legal case workflow with all MCP contexts
 * - Document processing pipeline with memory tracking
 * - Real-time collaboration and updates
 * - Error handling and recovery in production scenarios
 * - Performance and reliability under load
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { authSetup, cleanupAuth } from '../utils/auth-helpers';
import { waitForMCPInitialization, mockMCPServices as _mockMCPServices } from '../utils/mcp-helpers';

// Test configuration
const TEST_TIMEOUT = 60000; // 1 minute per test
const MCP_INIT_TIMEOUT = 10000; // 10 seconds for MCP initialization

// Test data
const TEST_USER = {
  username: 'testuser',
  password: 'password123',
  role: 'solicitor',
};

const TEST_CASE = {
  id: 'case-e2e-001',
  title: 'Contract Review - E2E Test Case',
  client: 'Test Client Ltd',
  type: 'contract_review',
};

const TEST_DOCUMENT = {
  name: 'test-contract.pdf',
  content: 'This is a test contract document for E2E testing.',
  path: '/test-uploads/test-contract.pdf',
};

test.describe('MCP Complete Workflow E2E', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // Set up authentication
    await authSetup(page, TEST_USER);
    
    // Navigate to application
    await page.goto('/');
    
    // Wait for MCP contexts to initialize
    await waitForMCPInitialization(page, MCP_INIT_TIMEOUT);
  });

  test.afterAll(async () => {
    await cleanupAuth(page);
    await context.close();
  });

  test('should complete full legal case workflow with MCP integration', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Step 1: Start new case with memory session
    await test.step('Create new case and start memory session', async () => {
      // Navigate to cases
      await page.click('[data-testid="nav-cases"]');
      await page.waitForSelector('[data-testid="cases-list"]');

      // Create new case
      await page.click('[data-testid="create-case-button"]');
      await page.waitForSelector('[data-testid="create-case-form"]');

      await page.fill('[data-testid="case-title"]', TEST_CASE.title);
      await page.fill('[data-testid="case-client"]', TEST_CASE.client);
      await page.selectOption('[data-testid="case-type"]', TEST_CASE.type);

      await page.click('[data-testid="save-case-button"]');

      // Wait for case creation and MCP memory session start
      await page.waitForSelector('[data-testid="case-detail-view"]');
      
      // Verify memory session was created
      await expect(page.locator('[data-testid="mcp-session-status"]')).toContainText('Active');
      
      // Verify initial memory item was saved
      await page.click('[data-testid="mcp-memory-panel"]');
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('Started legal work');
    });

    // Step 2: Upload and process document with file operations
    await test.step('Upload document and track with MCP file operations', async () => {
      // Navigate to documents tab
      await page.click('[data-testid="case-documents-tab"]');
      await page.waitForSelector('[data-testid="document-upload-area"]');

      // Create test file
      const fileContent = Buffer.from(TEST_DOCUMENT.content);
      
      // Upload file
      await page.setInputFiles('[data-testid="file-input"]', {
        name: TEST_DOCUMENT.name,
        mimeType: 'application/pdf',
        buffer: fileContent,
      });

      // Wait for upload progress
      await page.waitForSelector('[data-testid="upload-progress"]');
      await expect(page.locator('[data-testid="upload-progress"]')).toContainText('100%');

      // Verify file appears in MCP file operations
      await page.click('[data-testid="mcp-files-panel"]');
      await expect(page.locator('[data-testid="mcp-file-list"]')).toContainText(TEST_DOCUMENT.name);

      // Verify memory was updated with upload event
      await page.click('[data-testid="mcp-memory-panel"]');
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('Document uploaded');
    });

    // Step 3: Create workflow for document analysis
    await test.step('Create and execute legal workflow', async () => {
      // Navigate to workflow panel
      await page.click('[data-testid="mcp-workflow-panel"]');
      await page.waitForSelector('[data-testid="workflow-templates"]');

      // Select contract review workflow
      await page.click('[data-testid="workflow-template-contract-review"]');
      await page.waitForSelector('[data-testid="workflow-config-form"]');

      // Configure workflow
      await page.fill('[data-testid="workflow-name"]', 'Contract Review - ' + TEST_CASE.title);
      await page.selectOption('[data-testid="workflow-document"]', TEST_DOCUMENT.name);
      await page.selectOption('[data-testid="workflow-priority"]', 'high');

      // Start workflow
      await page.click('[data-testid="start-workflow-button"]');
      await page.waitForSelector('[data-testid="workflow-running"]');

      // Monitor workflow progress
      await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Running');
      
      // Wait for first step completion
      await page.waitForSelector('[data-testid="step-1-completed"]', { timeout: 30000 });
      
      // Verify memory tracking of workflow progress
      await page.click('[data-testid="mcp-memory-panel"]');
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('Workflow started');
    });

    // Step 4: Real-time collaboration simulation
    await test.step('Test real-time updates and collaboration', async () => {
      // Open second browser context to simulate another user
      const secondContext = await page.context().browser()?.newContext();
      const secondPage = await secondContext?.newPage();
      
      if (secondPage) {
        await authSetup(secondPage, { ...TEST_USER, username: 'collaborator' });
        await secondPage.goto(`/cases/${TEST_CASE.id}`);
        await waitForMCPInitialization(secondPage, MCP_INIT_TIMEOUT);

        // Add comment from second user
        await secondPage.click('[data-testid="case-comments-tab"]');
        await secondPage.fill('[data-testid="comment-input"]', 'Reviewing contract terms - looks good so far');
        await secondPage.click('[data-testid="add-comment-button"]');

        // Verify real-time update in first page
        await page.waitForSelector('[data-testid="new-comment-notification"]');
        await expect(page.locator('[data-testid="case-comments"]')).toContainText('Reviewing contract terms');

        // Verify memory was updated with collaboration event
        await page.click('[data-testid="mcp-memory-panel"]');
        await expect(page.locator('[data-testid="memory-items"]')).toContainText('Comment added');

        await secondContext?.close();
      }
    });

    // Step 5: AI analysis and memory integration
    await test.step('Perform AI analysis with memory tracking', async () => {
      // Navigate to AI analysis panel
      await page.click('[data-testid="ai-analysis-tab"]');
      await page.waitForSelector('[data-testid="ai-analysis-form"]');

      // Request contract analysis
      await page.fill('[data-testid="ai-prompt"]', 'Analyze this contract for potential risks and compliance issues');
      await page.selectOption('[data-testid="ai-model"]', 'llama3.1');
      await page.click('[data-testid="start-ai-analysis"]');

      // Wait for AI analysis to complete
      await page.waitForSelector('[data-testid="ai-analysis-result"]', { timeout: 45000 });
      
      // Verify analysis results
      await expect(page.locator('[data-testid="ai-analysis-result"]')).not.toBeEmpty();

      // Save analysis to memory
      await page.click('[data-testid="save-analysis-button"]');
      
      // Verify saved in memory context
      await page.click('[data-testid="mcp-memory-panel"]');
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('AI analysis completed');

      // Verify analysis searchable
      await page.fill('[data-testid="memory-search"]', 'contract risks');
      await page.click('[data-testid="memory-search-button"]');
      await expect(page.locator('[data-testid="memory-search-results"]')).not.toBeEmpty();
    });

    // Step 6: Git integration for version control
    await test.step('Commit case work with git integration', async () => {
      // Navigate to git panel
      await page.click('[data-testid="mcp-git-panel"]');
      await page.waitForSelector('[data-testid="git-status"]');

      // Check git status
      await expect(page.locator('[data-testid="git-staged"]')).toContainText('0 files');
      await expect(page.locator('[data-testid="git-unstaged"]')).not.toBeEmpty();

      // Stage files for commit
      await page.click('[data-testid="stage-all-button"]');
      await page.waitForSelector('[data-testid="git-staged"]:has-text("files")');

      // Create commit
      await page.fill('[data-testid="commit-message"]', `Complete case work for ${TEST_CASE.title}\n\n- Document uploaded and analyzed\n- AI analysis completed\n- Workflow executed successfully`);
      await page.click('[data-testid="commit-button"]');

      // Wait for commit completion
      await page.waitForSelector('[data-testid="commit-success"]');
      await expect(page.locator('[data-testid="git-status"]')).toContainText('Clean working directory');

      // Verify commit tracked in memory
      await page.click('[data-testid="mcp-memory-panel"]');
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('Git commit created');
    });

    // Step 7: Complete case and generate summary
    await test.step('Complete case with comprehensive summary', async () => {
      // Navigate to case completion
      await page.click('[data-testid="complete-case-button"]');
      await page.waitForSelector('[data-testid="case-completion-form"]');

      // Generate summary from memory
      await page.click('[data-testid="generate-summary-from-memory"]');
      await page.waitForSelector('[data-testid="generated-summary"]');

      // Verify summary includes all activities
      const summary = await page.locator('[data-testid="generated-summary"]').textContent();
      expect(summary).toContain('Document uploaded');
      expect(summary).toContain('AI analysis');
      expect(summary).toContain('Workflow executed');
      expect(summary).toContain('Git commit');

      // Add final notes
      await page.fill('[data-testid="completion-notes"]', 'Contract review completed successfully. All compliance requirements met.');

      // Complete case
      await page.click('[data-testid="finalize-case-button"]');
      await page.waitForSelector('[data-testid="case-completed-success"]');

      // Verify final memory entry
      await page.click('[data-testid="mcp-memory-panel"]');
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('Case completed');

      // Verify case status updated
      await expect(page.locator('[data-testid="case-status"]')).toContainText('Completed');
    });
  });

  test('should handle MCP error scenarios gracefully', async () => {
    test.setTimeout(TEST_TIMEOUT);

    await test.step('Handle memory service failure', async () => {
      // Mock memory service failure
      await page.route('**/api/mcp/memory/**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Memory service unavailable',
          }),
        });
      });

      // Try to save a memory item
      await page.goto('/cases');
      await page.click('[data-testid="mcp-memory-panel"]');
      await page.fill('[data-testid="quick-note-input"]', 'This should fail');
      await page.click('[data-testid="save-note-button"]');

      // Should show error message
      await expect(page.locator('[data-testid="mcp-error-message"]')).toContainText('Memory service unavailable');

      // Should provide retry option
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

      // Clear route mock
      await page.unroute('**/api/mcp/memory/**');
    });

    await test.step('Handle file operation failure', async () => {
      // Mock file operation failure
      await page.route('**/api/mcp/files/**', (route) => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Insufficient permissions',
          }),
        });
      });

      // Try to upload a file
      await page.click('[data-testid="mcp-files-panel"]');
      
      const fileContent = Buffer.from('Test file content');
      await page.setInputFiles('[data-testid="file-input"]', {
        name: 'test-fail.txt',
        mimeType: 'text/plain',
        buffer: fileContent,
      });

      // Should show permission error
      await expect(page.locator('[data-testid="file-error-message"]')).toContainText('Insufficient permissions');

      // Clear route mock
      await page.unroute('**/api/mcp/files/**');
    });

    await test.step('Handle WebSocket connection failure', async () => {
      // Close WebSocket connection
      await page.evaluate(() => {
        // Force close WebSocket connections
        (window as any).mcpWebSockets?.forEach((ws: WebSocket) => ws.close());
      });

      // Should show connection lost warning
      await expect(page.locator('[data-testid="connection-lost-warning"]')).toBeVisible();

      // Should attempt reconnection
      await expect(page.locator('[data-testid="reconnection-status"]')).toContainText('Reconnecting');

      // Wait for reconnection
      await page.waitForSelector('[data-testid="connection-restored"]', { timeout: 10000 });
    });
  });

  test('should handle concurrent workflows efficiently', async () => {
    test.setTimeout(TEST_TIMEOUT * 2); // Extended timeout for concurrent operations

    await test.step('Execute multiple workflows simultaneously', async () => {
      // Navigate to workflow management
      await page.goto('/workflows');
      await page.waitForSelector('[data-testid="workflow-dashboard"]');

      // Create multiple workflows
      const workflowConfigs = [
        { name: 'Contract Analysis A', type: 'contract_review', priority: 'high' },
        { name: 'Compliance Check B', type: 'compliance_check', priority: 'normal' },
        { name: 'Document Review C', type: 'document_processing', priority: 'low' },
      ];

      const workflowIds: string[] = [];

      for (const config of workflowConfigs) {
        await page.click('[data-testid="create-workflow-button"]');
        await page.fill('[data-testid="workflow-name"]', config.name);
        await page.selectOption('[data-testid="workflow-type"]', config.type);
        await page.selectOption('[data-testid="workflow-priority"]', config.priority);
        
        await page.click('[data-testid="start-workflow-button"]');
        
        // Get workflow ID from the created workflow
        const workflowId = await page.locator('[data-testid="new-workflow-id"]').textContent();
        if (workflowId) {
          workflowIds.push(workflowId);
        }
      }

      // Verify all workflows are running
      for (const workflowId of workflowIds) {
        await expect(page.locator(`[data-testid="workflow-${workflowId}-status"]`)).toContainText('Running');
      }

      // Monitor progress of all workflows
      await Promise.all(workflowIds.map(async (workflowId) => {
        await page.waitForSelector(`[data-testid="workflow-${workflowId}-completed"]`, { timeout: 45000 });
      }));

      // Verify memory tracked all workflow events
      await page.click('[data-testid="mcp-memory-panel"]');
      for (const config of workflowConfigs) {
        await expect(page.locator('[data-testid="memory-items"]')).toContainText(config.name);
      }
    });

    await test.step('Handle workflow failures and retries', async () => {
      // Mock workflow service to fail initially
      let failCount = 0;
      await page.route('**/api/mcp/workflow/execute/**', (route) => {
        failCount++;
        if (failCount <= 2) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Temporary service unavailable',
            }),
          });
        } else {
          route.continue();
        }
      });

      // Create workflow that will initially fail
      await page.click('[data-testid="create-workflow-button"]');
      await page.fill('[data-testid="workflow-name"]', 'Retry Test Workflow');
      await page.selectOption('[data-testid="workflow-type"]', 'contract_review');
      
      await page.click('[data-testid="start-workflow-button"]');

      // Should show failure
      await expect(page.locator('[data-testid="workflow-failed"]')).toBeVisible();

      // Click retry
      await page.click('[data-testid="retry-workflow-button"]');

      // Should fail again
      await expect(page.locator('[data-testid="workflow-failed"]')).toBeVisible();

      // Third retry should succeed
      await page.click('[data-testid="retry-workflow-button"]');
      await expect(page.locator('[data-testid="workflow-running"]')).toBeVisible();

      // Clear route mock
      await page.unroute('**/api/mcp/workflow/execute/**');
    });
  });

  test('should maintain data consistency across browser refresh', async () => {
    test.setTimeout(TEST_TIMEOUT);

    await test.step('Create data and refresh browser', async () => {
      // Create some test data
      await page.goto('/');
      await page.click('[data-testid="mcp-memory-panel"]');
      
      // Add memory items
      await page.fill('[data-testid="quick-note-input"]', 'Test note before refresh');
      await page.click('[data-testid="save-note-button"]');
      await page.waitForSelector('[data-testid="note-saved-confirmation"]');

      // Create a workflow
      await page.click('[data-testid="mcp-workflow-panel"]');
      await page.click('[data-testid="create-workflow-button"]');
      await page.fill('[data-testid="workflow-name"]', 'Pre-refresh Workflow');
      await page.click('[data-testid="start-workflow-button"]');
      
      const workflowId = await page.locator('[data-testid="new-workflow-id"]').textContent();

      // Refresh browser
      await page.reload();
      await waitForMCPInitialization(page, MCP_INIT_TIMEOUT);

      // Verify data persistence
      await page.click('[data-testid="mcp-memory-panel"]');
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('Test note before refresh');

      // Verify workflow state
      await page.click('[data-testid="mcp-workflow-panel"]');
      if (workflowId) {
        await expect(page.locator(`[data-testid="workflow-${workflowId}"]`)).toBeVisible();
      }

      // Verify git status maintained
      await page.click('[data-testid="mcp-git-panel"]');
      await expect(page.locator('[data-testid="git-status"]')).not.toBeEmpty();
    });

    await test.step('Verify real-time connections restored', async () => {
      // Check connection status
      await expect(page.locator('[data-testid="mcp-connection-status"]')).toContainText('Connected');

      // Test real-time functionality still works
      await page.click('[data-testid="mcp-memory-panel"]');
      await page.fill('[data-testid="quick-note-input"]', 'Test note after refresh');
      await page.click('[data-testid="save-note-button"]');

      // Should work without issues
      await page.waitForSelector('[data-testid="note-saved-confirmation"]');
    });
  });

  test('should handle large data sets and memory management', async () => {
    test.setTimeout(TEST_TIMEOUT * 2);

    await test.step('Create large number of memory items', async () => {
      await page.goto('/');
      await page.click('[data-testid="mcp-memory-panel"]');

      // Create development mode to seed large data
      await page.evaluate(() => {
        (window as any).mcpDevelopment?.enableDevMode();
      });

      // Generate large dataset
      const itemCount = 1000;
      const batchSize = 100;

      for (let i = 0; i < itemCount; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && (i + j) < itemCount; j++) {
          batch.push({
            key: `bulk-item-${i + j}`,
            value: `Bulk test item ${i + j} with some content for testing large data sets`,
            category: ['task', 'note', 'decision'][j % 3],
            priority: ['high', 'normal', 'low'][j % 3],
          });
        }

        // Batch save items
        await page.evaluate((items) => {
          return (window as any).mcpMemory?.batchSave(items);
        }, batch);

        // Show progress
        await page.waitForSelector(`[data-testid="memory-items-count"]:has-text("${Math.min(i + batchSize, itemCount)}")`);
      }

      // Verify all items loaded
      await expect(page.locator('[data-testid="memory-items-count"]')).toContainText(itemCount.toString());
    });

    await test.step('Test search performance with large dataset', async () => {
      // Test search functionality
      await page.fill('[data-testid="memory-search"]', 'bulk test item');
      await page.click('[data-testid="memory-search-button"]');

      // Should return results quickly
      await page.waitForSelector('[data-testid="search-results"]');
      const searchTime = await page.locator('[data-testid="search-time"]').textContent();
      
      // Search should complete within reasonable time (< 2 seconds)
      if (searchTime) {
        const timeMs = parseInt(searchTime.replace('ms', ''));
        expect(timeMs).toBeLessThan(2000);
      }

      // Test filtering
      await page.selectOption('[data-testid="search-category-filter"]', 'task');
      await page.click('[data-testid="apply-filters-button"]');

      await expect(page.locator('[data-testid="search-results"]')).not.toBeEmpty();
    });

    await test.step('Test memory cleanup and optimization', async () => {
      // Test memory compression
      await page.click('[data-testid="mcp-settings-button"]');
      await page.click('[data-testid="memory-optimization-tab"]');
      
      await page.click('[data-testid="compress-old-items-button"]');
      await page.waitForSelector('[data-testid="compression-complete"]');

      // Verify compression worked
      const compressedCount = await page.locator('[data-testid="compressed-items-count"]').textContent();
      expect(parseInt(compressedCount || '0')).toBeGreaterThan(0);

      // Test cleanup
      await page.click('[data-testid="cleanup-test-data-button"]');
      await page.waitForSelector('[data-testid="cleanup-complete"]');

      // Verify cleanup
      await page.click('[data-testid="mcp-memory-panel"]');
      const remainingCount = await page.locator('[data-testid="memory-items-count"]').textContent();
      expect(parseInt(remainingCount || '1000')).toBeLessThan(1000);
    });
  });

  test('should export and import MCP data correctly', async () => {
    test.setTimeout(TEST_TIMEOUT);

    await test.step('Create test data for export', async () => {
      await page.goto('/');
      
      // Create diverse test data
      await page.click('[data-testid="mcp-memory-panel"]');
      
      const testItems = [
        { key: 'export-task-1', value: 'Complete contract review', category: 'task', priority: 'high' },
        { key: 'export-note-1', value: 'Client meeting notes', category: 'note', priority: 'normal' },
        { key: 'export-decision-1', value: 'Approved contract terms', category: 'decision', priority: 'high' },
      ];

      for (const item of testItems) {
        await page.fill('[data-testid="quick-note-input"]', item.value);
        await page.selectOption('[data-testid="note-category"]', item.category);
        await page.selectOption('[data-testid="note-priority"]', item.priority);
        await page.click('[data-testid="save-note-button"]');
        await page.waitForSelector('[data-testid="note-saved-confirmation"]');
      }
    });

    await test.step('Export MCP data', async () => {
      // Navigate to export functionality
      await page.click('[data-testid="mcp-settings-button"]');
      await page.click('[data-testid="data-management-tab"]');

      // Start export
      await page.selectOption('[data-testid="export-format"]', 'json');
      await page.click('[data-testid="export-data-button"]');

      // Wait for export to complete
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;

      // Verify export file
      expect(download.suggestedFilename()).toMatch(/mcp-export.*\.json/);
      
      // Save export file for import test
      const exportPath = './test-exports/mcp-export.json';
      await download.saveAs(exportPath);
    });

    await test.step('Clear data and import', async () => {
      // Clear existing data
      await page.click('[data-testid="clear-all-data-button"]');
      await page.click('[data-testid="confirm-clear-button"]');
      
      // Verify data cleared
      await page.click('[data-testid="mcp-memory-panel"]');
      await expect(page.locator('[data-testid="memory-items-count"]')).toContainText('0');

      // Import data
      await page.click('[data-testid="mcp-settings-button"]');
      await page.click('[data-testid="data-management-tab"]');
      
      await page.setInputFiles('[data-testid="import-file-input"]', './test-exports/mcp-export.json');
      await page.click('[data-testid="import-data-button"]');

      // Wait for import completion
      await page.waitForSelector('[data-testid="import-complete"]');

      // Verify imported data
      await page.click('[data-testid="mcp-memory-panel"]');
      await expect(page.locator('[data-testid="memory-items-count"]')).toContainText('3');
      
      // Verify specific items
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('Complete contract review');
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('Client meeting notes');
      await expect(page.locator('[data-testid="memory-items"]')).toContainText('Approved contract terms');
    });
  });
});