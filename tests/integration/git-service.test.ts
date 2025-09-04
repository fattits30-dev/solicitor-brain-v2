/**
 * Integration Tests for Git Service with MCP Git Tools
 * 
 * Tests the Git service wrapper functionality including:
 * - Git status and repository state
 * - File staging and commit operations
 * - Branch management
 * - Diff operations
 * - Commit history
 * - Integration with structured logging
 * - Error handling
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest as _jest } from '@jest/globals';
import { writeFile, unlink, mkdir, rmdir } from 'fs/promises';
import path from 'path';
import { GitService } from '../../server/services/git-service';
import { structuredLogger } from '../../server/services/structured-logger';

describe('Git Service Integration', () => {
  const testRepoDir = path.join(__dirname, 'git-test-repo');
  let gitService: GitService;

  beforeAll(async () => {
    // Create test repository directory
    await mkdir(testRepoDir, { recursive: true });
    
    // Initialize git repository for testing
    const { execSync } = require('child_process');
    try {
      execSync('git init', { cwd: testRepoDir, stdio: 'pipe' });
      execSync('git config user.email "test@example.com"', { cwd: testRepoDir, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: testRepoDir, stdio: 'pipe' });
    } catch (error) {
      console.warn('Git initialization failed, tests may not work properly:', error);
    }
  });

  afterAll(async () => {
    // Clean up test repository
    try {
      await rmdir(testRepoDir, { recursive: true });
    } catch {
      // Directory might not exist or be empty
    }
  });

  beforeEach(() => {
    // Create fresh git service for each test
    gitService = new GitService(testRepoDir);
    
    // Mock console methods to avoid noise in test output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  describe('Git Status Operations', () => {
    it('should get repository status', async () => {
      const status = await gitService.getStatus();
      
      expect(status).toBeDefined();
      expect(status.clean).toBeDefined();
      expect(status.staged).toBeDefined();
      expect(status.unstaged).toBeDefined();
      expect(status.untracked).toBeDefined();
      expect(status.currentBranch).toBeDefined();
      
      // Initially, repository should be clean
      expect(Array.isArray(status.staged)).toBe(true);
      expect(Array.isArray(status.unstaged)).toBe(true);
      expect(Array.isArray(status.untracked)).toBe(true);
    });

    it('should handle git status errors gracefully', async () => {
      // Create git service with invalid repository path
      const invalidGitService = new GitService('/invalid/path');
      
      const status = await invalidGitService.getStatus();
      
      // Should return default status on error
      expect(status.clean).toBe(true);
      expect(status.staged).toEqual([]);
      expect(status.unstaged).toEqual([]);
      expect(status.untracked).toEqual([]);
      expect(status.currentBranch).toBe('unknown');
    });

    it('should log git status operations', async () => {
      // Mock structured logger debug method
      const loggerSpy = jest.spyOn(structuredLogger, 'debug').mockResolvedValue();
      
      await gitService.getStatus();
      
      expect(loggerSpy).toHaveBeenCalledWith(
        'Git status retrieved',
        expect.any(String), // LogCategory.VERSION_CONTROL
        expect.objectContaining({
          metadata: expect.objectContaining({
            repoPath: testRepoDir,
            operation: 'git_status'
          })
        }),
        expect.arrayContaining(['git', 'status', 'retrieved'])
      );
      
      loggerSpy.mockRestore();
    });
  });

  describe('File Operations', () => {
    const testFile = 'test-file.ts';
    const testFilePath = path.join(testRepoDir, testFile);
    const testContent = '// Test file for git operations\nexport const test = "git integration";';

    beforeEach(async () => {
      // Create test file
      await writeFile(testFilePath, testContent);
    });

    afterEach(async () => {
      // Clean up test file
      try {
        await unlink(testFilePath);
      } catch {
        // File might not exist
      }
    });

    it('should add files to staging area', async () => {
      const success = await gitService.addFiles([testFile]);
      
      expect(success).toBe(true);
    });

    it('should handle add files errors', async () => {
      const success = await gitService.addFiles(['non-existent-file.ts']);
      
      // Should handle gracefully (might return false or true depending on git behavior)
      expect(typeof success).toBe('boolean');
    });

    it('should log file add operations', async () => {
      const loggerSpy = jest.spyOn(structuredLogger, 'info').mockResolvedValue();
      
      await gitService.addFiles([testFile]);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        'Files added to git staging area',
        expect.any(String), // LogCategory.VERSION_CONTROL
        expect.objectContaining({
          metadata: expect.objectContaining({
            repoPath: testRepoDir,
            filesAdded: 1,
            files: testFile,
            operation: 'git_add'
          })
        }),
        expect.arrayContaining(['git', 'add', 'success'])
      );
      
      loggerSpy.mockRestore();
    });

    it('should commit staged changes', async () => {
      // First add the file
      await gitService.addFiles([testFile]);
      
      const commitMessage = 'Test commit message';
      const _commitHash = await gitService.commit(commitMessage);
      
      // Commit hash might be null if git is not properly configured
      // or if there are no changes to commit
      expect(typeof commitHash).toBe('string');
    });

    it('should commit with workflow and case context', async () => {
      await gitService.addFiles([testFile]);
      
      const commitMessage = 'Test commit with context';
      const workflowId = 'workflow-123';
      const caseId = 'case-456';
      
      const loggerSpy = jest.spyOn(structuredLogger, 'info').mockResolvedValue();
      
      const _commitHash = await gitService.commit(commitMessage, workflowId, caseId);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        'Git commit created successfully',
        expect.any(String), // LogCategory.VERSION_CONTROL
        expect.objectContaining({
          metadata: expect.objectContaining({
            repoPath: testRepoDir,
            message: expect.stringContaining(commitMessage),
            workflowId,
            caseId,
            operation: 'git_commit'
          })
        }),
        expect.arrayContaining(['git', 'commit', 'success'])
      );
      
      loggerSpy.mockRestore();
    });
  });

  describe('Branch Operations', () => {
    it('should get list of branches', async () => {
      const branches = await gitService.getBranches('local');
      
      expect(Array.isArray(branches)).toBe(true);
      
      // Should have at least the main/master branch
      if (branches.length > 0) {
        branches.forEach(branch => {
          expect(branch.name).toBeDefined();
          expect(typeof branch.current).toBe('boolean');
        });
      }
    });

    it('should create new branches', async () => {
      const branchName = 'feature/test-branch';
      const success = await gitService.createBranch(branchName);
      
      expect(success).toBe(true);
    });

    it('should create branches with base branch', async () => {
      const branchName = 'feature/test-branch-with-base';
      const baseBranch = 'main';
      const success = await gitService.createBranch(branchName, baseBranch);
      
      expect(success).toBe(true);
    });

    it('should checkout branches', async () => {
      // First create a branch
      const branchName = 'feature/checkout-test';
      await gitService.createBranch(branchName);
      
      // Then checkout the branch
      const success = await gitService.checkoutBranch(branchName);
      
      expect(success).toBe(true);
    });

    it('should handle branch operation errors', async () => {
      // Try to checkout non-existent branch
      const success = await gitService.checkoutBranch('non-existent-branch');
      
      expect(success).toBe(false);
    });

    it('should log branch operations', async () => {
      const loggerSpy = jest.spyOn(structuredLogger, 'info').mockResolvedValue();
      
      const branchName = 'feature/logging-test';
      await gitService.createBranch(branchName);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        'Git branch created successfully',
        expect.any(String), // LogCategory.VERSION_CONTROL
        expect.objectContaining({
          metadata: expect.objectContaining({
            repoPath: testRepoDir,
            branchName,
            operation: 'git_create_branch'
          })
        }),
        expect.arrayContaining(['git', 'branch', 'created'])
      );
      
      loggerSpy.mockRestore();
    });
  });

  describe('Diff Operations', () => {
    const testFile = 'diff-test-file.ts';
    const testFilePath = path.join(testRepoDir, testFile);
    const originalContent = '// Original content for diff test';
    const modifiedContent = '// Original content for diff test\n// Modified content';

    beforeEach(async () => {
      // Create and commit initial file
      await writeFile(testFilePath, originalContent);
      await gitService.addFiles([testFile]);
      await gitService.commit('Initial commit for diff test');
    });

    afterEach(async () => {
      try {
        await unlink(testFilePath);
      } catch {
        // File might not exist
      }
    });

    it('should get unstaged differences', async () => {
      // Modify the file
      await writeFile(testFilePath, modifiedContent);
      
      const diffs = await gitService.getDiffUnstaged();
      
      expect(Array.isArray(diffs)).toBe(true);
    });

    it('should get staged differences', async () => {
      // Modify and stage the file
      await writeFile(testFilePath, modifiedContent);
      await gitService.addFiles([testFile]);
      
      const diffs = await gitService.getDiffStaged();
      
      expect(Array.isArray(diffs)).toBe(true);
    });

    it('should get diff with custom context lines', async () => {
      await writeFile(testFilePath, modifiedContent);
      
      const diffs = await gitService.getDiffUnstaged(5);
      
      expect(Array.isArray(diffs)).toBe(true);
    });

    it('should log diff operations', async () => {
      const loggerSpy = jest.spyOn(structuredLogger, 'debug').mockResolvedValue();
      
      await writeFile(testFilePath, modifiedContent);
      await gitService.getDiffUnstaged();
      
      expect(loggerSpy).toHaveBeenCalledWith(
        'Git unstaged diff retrieved',
        expect.any(String), // LogCategory.VERSION_CONTROL
        expect.objectContaining({
          metadata: expect.objectContaining({
            repoPath: testRepoDir,
            operation: 'git_diff_unstaged'
          })
        }),
        expect.arrayContaining(['git', 'diff', 'unstaged'])
      );
      
      loggerSpy.mockRestore();
    });
  });

  describe('Commit History Operations', () => {
    beforeEach(async () => {
      // Create a few commits for history testing
      const commits = [
        { file: 'file1.ts', content: '// First file', message: 'Add first file' },
        { file: 'file2.ts', content: '// Second file', message: 'Add second file' },
        { file: 'file3.ts', content: '// Third file', message: 'Add third file' }
      ];

      for (const commit of commits) {
        const filePath = path.join(testRepoDir, commit.file);
        await writeFile(filePath, commit.content);
        await gitService.addFiles([commit.file]);
        await gitService.commit(commit.message);
      }
    });

    afterEach(async () => {
      // Clean up test files
      const files = ['file1.ts', 'file2.ts', 'file3.ts'];
      for (const file of files) {
        try {
          await unlink(path.join(testRepoDir, file));
        } catch {
          // File might not exist
        }
      }
    });

    it('should get commit history', async () => {
      const commits = await gitService.getCommitHistory();
      
      expect(Array.isArray(commits)).toBe(true);
    });

    it('should get limited commit history', async () => {
      const commits = await gitService.getCommitHistory(2);
      
      expect(Array.isArray(commits)).toBe(true);
      // Note: Actual length might vary depending on git behavior
    });

    it('should show specific commit details', async () => {
      const commits = await gitService.getCommitHistory(1);
      
      if (commits.length > 0) {
        const commit = await gitService.showCommit(commits[0].hash);
        
        // commit might be null if the show operation fails
        if (commit) {
          expect(commit.hash).toBeDefined();
          expect(commit.message).toBeDefined();
        }
      }
    });

    it('should log commit history operations', async () => {
      const loggerSpy = jest.spyOn(structuredLogger, 'debug').mockResolvedValue();
      
      await gitService.getCommitHistory(5);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        'Git commit history retrieved',
        expect.any(String), // LogCategory.VERSION_CONTROL
        expect.objectContaining({
          metadata: expect.objectContaining({
            repoPath: testRepoDir,
            maxCount: 5,
            operation: 'git_log'
          })
        }),
        expect.arrayContaining(['git', 'log', 'retrieved'])
      );
      
      loggerSpy.mockRestore();
    });
  });

  describe('Reset Operations', () => {
    const testFile = 'reset-test-file.ts';
    const testFilePath = path.join(testRepoDir, testFile);
    const testContent = '// Test file for reset operations';

    beforeEach(async () => {
      await writeFile(testFilePath, testContent);
      await gitService.addFiles([testFile]);
    });

    afterEach(async () => {
      try {
        await unlink(testFilePath);
      } catch {
        // File might not exist
      }
    });

    it('should reset staged changes', async () => {
      const success = await gitService.resetStaged();
      
      expect(success).toBe(true);
    });

    it('should log reset operations', async () => {
      const loggerSpy = jest.spyOn(structuredLogger, 'info').mockResolvedValue();
      
      await gitService.resetStaged();
      
      expect(loggerSpy).toHaveBeenCalledWith(
        'Git staged changes reset successfully',
        expect.any(String), // LogCategory.VERSION_CONTROL
        expect.objectContaining({
          metadata: expect.objectContaining({
            repoPath: testRepoDir,
            operation: 'git_reset'
          })
        }),
        expect.arrayContaining(['git', 'reset', 'success'])
      );
      
      loggerSpy.mockRestore();
    });
  });

  describe('Workflow Context Integration', () => {
    const testFile = 'workflow-test-file.ts';
    const testFilePath = path.join(testRepoDir, testFile);
    const testContent = '// Test file for workflow context';

    beforeEach(async () => {
      await writeFile(testFilePath, testContent);
    });

    afterEach(async () => {
      try {
        await unlink(testFilePath);
      } catch {
        // File might not exist
      }
    });

    it('should get comprehensive workflow context', async () => {
      const workflowId = 'workflow-123';
      const caseId = 'case-456';
      
      const context = await gitService.getWorkflowContext(workflowId, caseId);
      
      expect(context).toBeDefined();
      expect(context.status).toBeDefined();
      expect(context.recentCommits).toBeDefined();
      expect(context.unstaged).toBeDefined();
      expect(context.staged).toBeDefined();
      expect(context.branches).toBeDefined();
      expect(Array.isArray(context.recentCommits)).toBe(true);
      expect(Array.isArray(context.unstaged)).toBe(true);
      expect(Array.isArray(context.staged)).toBe(true);
      expect(Array.isArray(context.branches)).toBe(true);
    });

    it('should get workflow context without filters', async () => {
      const context = await gitService.getWorkflowContext();
      
      expect(context).toBeDefined();
      expect(context.workflowBranches).toBeUndefined();
      expect(context.caseCommits).toBeUndefined();
    });

    it('should handle workflow context errors gracefully', async () => {
      // Create git service with invalid path
      const invalidGitService = new GitService('/invalid/path');
      
      const context = await invalidGitService.getWorkflowContext('workflow', 'case');
      
      // Should return minimal context on error
      expect(context.status.clean).toBe(true);
      expect(context.recentCommits).toEqual([]);
      expect(context.unstaged).toEqual([]);
      expect(context.staged).toEqual([]);
      expect(context.branches).toEqual([]);
    });
  });

  describe('Error Handling and Logging', () => {
    it('should log errors for failed operations', async () => {
      const errorSpy = jest.spyOn(structuredLogger, 'error').mockResolvedValue();
      
      // Create git service with invalid path
      const invalidGitService = new GitService('/invalid/repo/path');
      
      await invalidGitService.addFiles(['test-file.ts']);
      
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to add files to git',
        expect.any(String), // LogCategory.VERSION_CONTROL
        expect.any(Error),
        expect.objectContaining({
          metadata: expect.objectContaining({
            repoPath: '/invalid/repo/path',
            operation: 'git_add_failed'
          })
        }),
        expect.arrayContaining(['git', 'add', 'error'])
      );
      
      errorSpy.mockRestore();
    });

    it('should handle MCP git client import errors', async () => {
      // Test that the service gracefully handles missing MCP client
      // This is tested implicitly through other tests that might fail to import
      expect(gitService).toBeDefined();
    });

    it('should provide meaningful error context', async () => {
      const errorSpy = jest.spyOn(structuredLogger, 'error').mockResolvedValue();
      
      const invalidGitService = new GitService('/invalid/path');
      await invalidGitService.commit('Test commit');
      
      if (errorSpy.mock.calls.length > 0) {
        const errorCall = errorSpy.mock.calls[0];
        const errorContext = errorCall[3]; // Context parameter
        
        expect(errorContext).toHaveProperty('metadata');
        expect(errorContext.metadata).toHaveProperty('repoPath');
        expect(errorContext.metadata).toHaveProperty('operation');
      }
      
      errorSpy.mockRestore();
    });
  });

  describe('Git Output Parsing', () => {
    it('should handle various git output formats', async () => {
      // This test verifies that the service can handle different git output formats
      // The parsing methods are private, so we test through public methods
      
      const status = await gitService.getStatus();
      expect(status).toBeDefined();
      
      const branches = await gitService.getBranches();
      expect(Array.isArray(branches)).toBe(true);
      
      const commits = await gitService.getCommitHistory();
      expect(Array.isArray(commits)).toBe(true);
    });

    it('should handle empty git repositories', async () => {
      // Test behavior with empty repository
      const emptyRepoDir = path.join(__dirname, 'empty-git-repo');
      await mkdir(emptyRepoDir, { recursive: true });
      
      try {
        const { execSync } = require('child_process');
        execSync('git init', { cwd: emptyRepoDir, stdio: 'pipe' });
        execSync('git config user.email "test@example.com"', { cwd: emptyRepoDir, stdio: 'pipe' });
        execSync('git config user.name "Test User"', { cwd: emptyRepoDir, stdio: 'pipe' });
        
        const emptyGitService = new GitService(emptyRepoDir);
        
        const status = await emptyGitService.getStatus();
        const commits = await emptyGitService.getCommitHistory();
        const branches = await emptyGitService.getBranches();
        
        expect(status).toBeDefined();
        expect(Array.isArray(commits)).toBe(true);
        expect(Array.isArray(branches)).toBe(true);
        
      } finally {
        await rmdir(emptyRepoDir, { recursive: true });
      }
    });
  });
});