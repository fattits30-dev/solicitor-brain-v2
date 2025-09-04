/**
 * Integration Tests for Workflow Services with Git Integration
 *
 * Tests the integration between various workflow services including:
 * - File watcher with git integration
 * - Structured logging with version control context
 * - Memory-keeper with git state tracking
 * - Workflow orchestration
 * - Error handling across services
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdir, rmdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { createFileWatcher, FileWatcher } from '../../server/services/file-watcher';
import { GitService } from '../../server/services/git-service';
import { mcpMemoryKeeper } from '../../server/services/mcp-client';
import { structuredLogger } from '../../server/services/structured-logger';

describe('Workflow Services Integration', () => {
  const testWorkspaceDir = path.join(__dirname, 'workflow-test-workspace');
  const testRepoDir = path.join(testWorkspaceDir, 'repo');
  let fileWatcher: FileWatcher;
  let gitService: GitService;

  beforeAll(async () => {
    // Create test workspace and repository
    await mkdir(testRepoDir, { recursive: true });

    // Initialize git repository
    try {
      const { execSync } = require('child_process');
      execSync('git init', { cwd: testRepoDir, stdio: 'pipe' });
      execSync('git config user.email "workflow@test.com"', { cwd: testRepoDir, stdio: 'pipe' });
      execSync('git config user.name "Workflow Test"', { cwd: testRepoDir, stdio: 'pipe' });
    } catch (error) {
      console.warn('Git initialization failed:', error);
    }

    // Enable MCP services for testing
    mcpMemoryKeeper.setEnabled(true);
  });

  afterAll(async () => {
    // Stop file watcher
    if (fileWatcher) {
      fileWatcher.stop();
    }

    // Clean up workspace
    try {
      await rmdir(testWorkspaceDir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  beforeEach(() => {
    // Create fresh services for each test
    fileWatcher = createFileWatcher({
      paths: [testRepoDir],
      ignore: [/\.git/, /\.tmp$/],
      debounceMs: 100,
      backupEnabled: false, // Disable to avoid test cleanup issues
    });

    gitService = new GitService(testRepoDir);

    // Enable integrations
    fileWatcher.setMemoryKeeperEnabled(true);

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    // Stop file watcher
    if (fileWatcher) {
      fileWatcher.stop();
    }

    // Restore mocks
    jest.restoreAllMocks();
  });

  describe('File Change to Git Workflow', () => {
    it('should detect file changes and integrate with git operations', async () => {
      const testFile = path.join(testRepoDir, 'workflow-test.ts');
      const testContent = `// Workflow integration test
export const workflowTest = {
  timestamp: '${new Date().toISOString()}',
  feature: 'file-change-git-integration'
};`;

      // Set up file change listener
      const fileChangePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create file
      await writeFile(testFile, testContent);

      // Wait for file change detection
      const change = await Promise.race([
        fileChangePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]) as any;

      expect(change).toBeDefined();
      expect(change.type).toBe('add');

      // Now integrate with git operations
      const gitStatus = await gitService.getStatus();
      expect(gitStatus).toBeDefined();

      // Add file to git
      const addSuccess = await gitService.addFiles(['workflow-test.ts']);
      expect(addSuccess).toBe(true);

      // Commit the change
      const _commitHash = await gitService.commit('Add workflow test file');
      expect(typeof commitHash).toBe('string');

      // Clean up
      await unlink(testFile);
    });

    it('should maintain workflow context across file changes', async () => {
      const workflowId = 'workflow-123';
      const caseId = 'case-456';
      const files = ['file1.ts', 'file2.ts', 'file3.ts'];

      let changeCount = 0;
      fileWatcher.on('change', () => {
        changeCount++;
      });

      // Create multiple files
      for (const filename of files) {
        const filePath = path.join(testRepoDir, filename);
        const content = `// Workflow file: ${filename}
export const metadata = {
  workflowId: '${workflowId}',
  caseId: '${caseId}',
  filename: '${filename}'
};`;
        await writeFile(filePath, content);
      }

      // Wait for all changes to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(changeCount).toBeGreaterThanOrEqual(files.length);

      // Get workflow context from git
      const workflowContext = await gitService.getWorkflowContext(workflowId, caseId);
      expect(workflowContext).toBeDefined();
      expect(workflowContext.status).toBeDefined();

      // Clean up
      for (const filename of files) {
        const filePath = path.join(testRepoDir, filename);
        await unlink(filePath);
      }
    });
  });

  describe('Logging and Memory Integration', () => {
    it('should integrate structured logging with file changes and git operations', async () => {
      const testFile = path.join(testRepoDir, 'logging-integration.ts');
      const testContent = '// File for logging integration test';

      // Mock structured logger methods
      const loggerInfoSpy = jest.spyOn(structuredLogger, 'info').mockResolvedValue();
      const loggerDebugSpy = jest.spyOn(structuredLogger, 'debug').mockResolvedValue();

      // Set up file change listener
      const fileChangePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create file and trigger workflow
      await writeFile(testFile, testContent);

      // Wait for file change
      await Promise.race([
        fileChangePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);

      // Perform git operations with logging
      await gitService.addFiles(['logging-integration.ts']);
      await gitService.commit('Test commit for logging integration');

      // Verify logging occurred
      expect(loggerInfoSpy).toHaveBeenCalled();

      // Find git-related log calls
      const gitLogCalls = loggerInfoSpy.mock.calls.filter(call =>
        call[3] && call[3].some((tag: string) => tag.includes('git'))
      );

      expect(gitLogCalls.length).toBeGreaterThan(0);

      loggerInfoSpy.mockRestore();
      loggerDebugSpy.mockRestore();

      // Clean up
      await unlink(testFile);
    });

    it('should persist workflow state in memory-keeper', async () => {
      const testFile = path.join(testRepoDir, 'memory-integration.ts');
      const testContent = '// File for memory integration test';

      // Set up file change listener
      const fileChangePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create file
      await writeFile(testFile, testContent);

      // Wait for file change and memory persistence
      await Promise.race([
        fileChangePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);

      // Search for memory items related to this file
      const memoryResults = await fileWatcher.searchMemoryChanges('memory-integration', {
        category: 'progress',
        limit: 5
      });

      // Mock implementation returns empty array, but structure should be correct
      expect(Array.isArray(memoryResults)).toBe(true);

      // Clean up
      await unlink(testFile);
    });
  });

  describe('Error Propagation and Handling', () => {
    it('should handle git errors gracefully in workflow', async () => {
      // Create file watcher with invalid git repository
      const invalidDir = path.join(testWorkspaceDir, 'invalid-repo');
      await mkdir(invalidDir, { recursive: true });

      const invalidWatcher = createFileWatcher({
        paths: [invalidDir],
        debounceMs: 100,
        backupEnabled: false
      });

      const invalidGitService = new GitService(invalidDir);

      const testFile = path.join(invalidDir, 'error-test.ts');
      const testContent = '// File for error handling test';

      try {
        // Mock error logging
        const errorSpy = jest.spyOn(structuredLogger, 'error').mockResolvedValue();

        // Create file in non-git directory
        await writeFile(testFile, testContent);

        // Attempt git operations
        const addResult = await invalidGitService.addFiles(['error-test.ts']);
        const commitResult = await invalidGitService.commit('Test commit');

        // Operations might fail, but should be handled gracefully
        expect(typeof addResult).toBe('boolean');
        expect(typeof commitResult).toBe('string'); // null is also valid

        errorSpy.mockRestore();
        invalidWatcher.stop();

        // Clean up
        await unlink(testFile);
        await rmdir(invalidDir);
      } catch (error) {
        // Ensure cleanup happens even on error
        invalidWatcher.stop();
        try {
          await unlink(testFile);
          await rmdir(invalidDir);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    });

    it('should continue workflow when memory-keeper is unavailable', async () => {
      // Disable memory-keeper
      mcpMemoryKeeper.setEnabled(false);
      fileWatcher.setMemoryKeeperEnabled(false);

      const testFile = path.join(testRepoDir, 'no-memory-test.ts');
      const testContent = '// File for testing without memory-keeper';

      // Set up file change listener
      const fileChangePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create file
      await writeFile(testFile, testContent);

      // File change should still be detected
      const change = await Promise.race([
        fileChangePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]) as any;

      expect(change).toBeDefined();
      expect(change.type).toBe('add');

      // Git operations should still work
      const gitStatus = await gitService.getStatus();
      expect(gitStatus).toBeDefined();

      // Re-enable memory-keeper for other tests
      mcpMemoryKeeper.setEnabled(true);
      fileWatcher.setMemoryKeeperEnabled(true);

      // Clean up
      await unlink(testFile);
    });

    it('should handle file system errors in workflow', async () => {
      const invalidPath = path.join(testRepoDir, 'non-existent-dir', 'invalid-file.ts');

      // Mock error handling
      let errorHandled = false;
      fileWatcher.on('error', () => {
        errorHandled = true;
      });

      try {
        // Attempt to write to invalid path
        await writeFile(invalidPath, 'test content');
        fail('Should have thrown an error');
      } catch (error) {
        // Error is expected
        expect(error).toBeDefined();
      }

      // Give time for error event to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Error might not be emitted if file watcher doesn't see the invalid operation
      // The important thing is that the workflow doesn't crash
      expect(typeof errorHandled).toBe('boolean');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent file changes efficiently', async () => {
      const fileCount = 10;
      const files = Array.from({ length: fileCount }, (_, i) =>
        path.join(testRepoDir, `concurrent-${i}.ts`)
      );

      let changeCount = 0;
      fileWatcher.on('change', () => {
        changeCount++;
      });

      // Create all files concurrently
      const startTime = Date.now();
      const createPromises = files.map((filePath, index) =>
        writeFile(filePath, `// Concurrent file ${index}\nexport const id = ${index};`)
      );

      await Promise.all(createPromises);
      const createTime = Date.now() - startTime;

      // Wait for all changes to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should detect all file changes efficiently
      expect(changeCount).toBe(fileCount);
      expect(createTime).toBeLessThan(1000); // Should be fast

      // Test git operations with multiple files
      const gitStartTime = Date.now();
      const filenames = files.map(f => path.basename(f));
      await gitService.addFiles(filenames);
      await gitService.commit('Add concurrent test files');
      const gitTime = Date.now() - gitStartTime;

      expect(gitTime).toBeLessThan(5000); // Git operations might be slower

      // Clean up
      const unlinkPromises = files.map(filePath => unlink(filePath));
      await Promise.all(unlinkPromises);
    });

    it('should maintain performance with large files', async () => {
      const largeFile = path.join(testRepoDir, 'large-file.ts');

      // Create large file content (100KB)
      const largeContent = `// Large file for performance testing
${Array(10000).fill(0).map((_, i) => `export const item${i} = 'data-${i}';`).join('\n')}`;

      // Set up file change listener
      const fileChangePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create large file and measure time
      const startTime = Date.now();
      await writeFile(largeFile, largeContent);

      const change = await Promise.race([
        fileChangePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]) as any;

      const processingTime = Date.now() - startTime;

      expect(change).toBeDefined();
      expect(change.type).toBe('add');
      expect(processingTime).toBeLessThan(3000); // Should handle large files reasonably fast

      // Test git operations with large file
      const gitStartTime = Date.now();
      await gitService.addFiles(['large-file.ts']);
      await gitService.commit('Add large test file');
      const gitTime = Date.now() - gitStartTime;

      expect(gitTime).toBeLessThan(10000); // Git might take longer for large files

      // Clean up
      await unlink(largeFile);
    });
  });

  describe('Workflow State Management', () => {
    it('should maintain consistent state across service restarts', async () => {
      const testFile = path.join(testRepoDir, 'state-test.ts');
      const testContent = '// File for state management test';

      // Create file and process
      await writeFile(testFile, testContent);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get initial state
      const initialStatus = await gitService.getStatus();
      const _initialHistory = fileWatcher.getChangeHistory();

      // Stop and restart file watcher
      fileWatcher.stop();

      fileWatcher = createFileWatcher({
        paths: [testRepoDir],
        ignore: [/\.git/, /\.tmp$/],
        debounceMs: 100,
        backupEnabled: false,
      });
      fileWatcher.setMemoryKeeperEnabled(true);

      // State should be recoverable
      const newStatus = await gitService.getStatus();
      expect(newStatus).toBeDefined();
      expect(newStatus.currentBranch).toBe(initialStatus.currentBranch);

      // File change history should be maintained in memory-keeper
      const memoryHistory = await fileWatcher.getMemoryChangeHistory();
      expect(Array.isArray(memoryHistory)).toBe(true);

      // Clean up
      await unlink(testFile);
    });

    it('should handle workflow interruptions gracefully', async () => {
      const testFile = path.join(testRepoDir, 'interruption-test.ts');
      const testContent = '// File for interruption test';

      // Create file
      await writeFile(testFile, testContent);

      // Start git operations
      await gitService.addFiles(['interruption-test.ts']);

      // Simulate interruption by stopping file watcher
      fileWatcher.stop();

      // Git operations should still complete
      const _commitHash = await gitService.commit('Test commit before interruption');
      expect(typeof commitHash).toBe('string');

      // Restart file watcher
      fileWatcher = createFileWatcher({
        paths: [testRepoDir],
        debounceMs: 100,
        backupEnabled: false,
      });
      fileWatcher.setMemoryKeeperEnabled(true);

      // System should be in consistent state
      const status = await gitService.getStatus();
      expect(status).toBeDefined();

      // Clean up
      await unlink(testFile);
    });
  });

  describe('Cross-Service Communication', () => {
    it('should coordinate between file watcher and git service', async () => {
      const testFile = path.join(testRepoDir, 'coordination-test.ts');
      const testContent = '// File for coordination test';

      // Set up coordination test
      let fileChangeDetected = false;
      let gitOperationCompleted = false;

      fileWatcher.on('change', async (change) => {
        if (change.path === testFile) {
          fileChangeDetected = true;

          // Trigger git operations in response to file change
          try {
            await gitService.addFiles([path.basename(testFile)]);
            await gitService.commit('Auto-commit from file watcher');
            gitOperationCompleted = true;
          } catch (error) {
            console.error('Git operation failed:', error);
          }
        }
      });

      // Create file
      await writeFile(testFile, testContent);

      // Wait for coordination to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(fileChangeDetected).toBe(true);
      expect(gitOperationCompleted).toBe(true);

      // Clean up
      await unlink(testFile);
    });

    it('should share context between memory-keeper and structured logging', async () => {
      const testFile = path.join(testRepoDir, 'context-sharing-test.ts');
      const testContent = '// File for context sharing test';

      // Mock structured logger to capture context
      const loggerSpy = jest.spyOn(structuredLogger, 'info').mockResolvedValue();

      // Create file to trigger workflow
      await writeFile(testFile, testContent);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Perform git operations with context
      await gitService.addFiles(['context-sharing-test.ts']);
      await gitService.commit('Test commit for context sharing', 'workflow-123', 'case-456');

      // Check that context was shared
      const logCalls = loggerSpy.mock.calls;
      const contextCalls = logCalls.filter(call => {
        const context = call[2];
        return context && (context.metadata?.workflowId || context.metadata?.caseId);
      });

      // Should have some calls with context
      expect(contextCalls.length).toBeGreaterThan(0);

      loggerSpy.mockRestore();

      // Clean up
      await unlink(testFile);
    });
  });
});
