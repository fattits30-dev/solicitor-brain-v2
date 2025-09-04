import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { agentOrchestrator } from '../services/agent-orchestrator';
import { agentWorkflow, JobType } from '../services/agent-workflow';
import { gitService } from '../services/git-service';
import { legalDocumentWorkflowService } from '../services/legal-document-workflow';

describe('Git Integration Tests', () => {
  let testRepoPath: string;
  let testCaseId: string;
  let testWorkflowId: string;

  beforeAll(async () => {
    // Create a temporary directory for testing
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'solicitor-brain-git-test-'));
    testCaseId = `test_case_${Date.now()}`;
    testWorkflowId = `test_workflow_${Date.now()}`;

    // Initialize a git repository in the test directory
    process.chdir(testRepoPath);

    try {
      const { execSync } = require('child_process');
      execSync('git init', { cwd: testRepoPath });
      execSync('git config user.name "Test User"', { cwd: testRepoPath });
      execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

      // Create initial commit
      await fs.writeFile(path.join(testRepoPath, 'README.md'), '# Test Repository for Solicitor Brain Git Integration');
      execSync('git add README.md', { cwd: testRepoPath });
      execSync('git commit -m "Initial commit"', { cwd: testRepoPath });
    } catch (error) {
      console.warn('Git not available for testing, tests may not work properly:', error);
    }
  }, 30000);

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rmdir(testRepoPath, { recursive: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  describe('Git Service Basic Operations', () => {
    it('should get repository status', async () => {
      const status = await gitService.getStatus();

      expect(status).toHaveProperty('clean');
      expect(status).toHaveProperty('staged');
      expect(status).toHaveProperty('unstaged');
      expect(status).toHaveProperty('untracked');
      expect(status).toHaveProperty('currentBranch');
      expect(Array.isArray(status.staged)).toBe(true);
      expect(Array.isArray(status.unstaged)).toBe(true);
      expect(Array.isArray(status.untracked)).toBe(true);
    });

    it('should get commit history', async () => {
      const history = await gitService.getCommitHistory(5);

      expect(Array.isArray(history)).toBe(true);
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('hash');
        expect(history[0]).toHaveProperty('author');
        expect(history[0]).toHaveProperty('date');
        expect(history[0]).toHaveProperty('message');
      }
    });

    it('should create and switch branches', async () => {
      const branchName = `test-branch-${Date.now()}`;

      const created = await gitService.createBranch(branchName);
      expect(created).toBe(true);

      const status = await gitService.getStatus();
      expect(status.currentBranch).toBe(branchName);

      // Switch back to main/master
      const switchedBack = await gitService.checkoutBranch('master') ||
                           await gitService.checkoutBranch('main');
      expect(switchedBack).toBe(true);
    });

    it('should add files and create commits', async () => {
      const testFile = path.join(testRepoPath, 'test-file.txt');
      await fs.writeFile(testFile, 'Test content for git integration');

      const added = await gitService.addFiles(['test-file.txt']);
      expect(added).toBe(true);

      const _commitHash = await gitService.commit('Add test file for integration testing');
      expect(commitHash).toBeTruthy();
      expect(typeof commitHash).toBe('string');
    });

    it('should get workflow context', async () => {
      const context = await gitService.getWorkflowContext(testWorkflowId, testCaseId);

      expect(context).toHaveProperty('status');
      expect(context).toHaveProperty('recentCommits');
      expect(context).toHaveProperty('unstaged');
      expect(context).toHaveProperty('staged');
      expect(context).toHaveProperty('branches');
    });
  });

  describe('Agent Workflow Git Integration', () => {
    it('should create workflow with git tracking enabled', async () => {
      const jobData = {
        id: `job_${testWorkflowId}`,
        type: JobType.CASE_ANALYSIS,
        priority: 1,
        data: {
          caseData: {
            id: testCaseId,
            title: 'Test Case for Git Integration',
            type: 'personal_injury'
          }
        },
        metadata: {
          caseId: testCaseId,
          workflowId: testWorkflowId,
          trackInGit: true,
          userId: 'test-user'
        }
      };

      const jobId = await agentWorkflow.submitJob(jobData);
      expect(jobId).toBeTruthy();
      expect(typeof jobId).toBe('string');

      // Wait a bit for job processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if workflow status includes git information
      const status = await agentWorkflow.getWorkflowStatus();
      expect(status).toHaveProperty('git');
    }, 15000);

    it('should handle document generation with git versioning', async () => {
      const agentTask = {
        id: `draft_task_${Date.now()}`,
        type: 'draft_generation' as const,
        complexity: 'medium' as const,
        context: JSON.stringify({
          caseId: testCaseId,
          documentType: 'letter_before_action',
          clientName: 'Test Client',
          defendant: 'Test Defendant'
        }),
        prompt: 'Generate a letter before action for a personal injury case',
        workflowId: testWorkflowId,
        caseId: testCaseId,
        trackInGit: true
      };

      const response = await agentOrchestrator.processTask(agentTask);

      expect(response).toHaveProperty('taskId');
      expect(response).toHaveProperty('result');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('processingTime');
      expect(response.result).toBeTruthy();
      expect(typeof response.result).toBe('string');

      // Should have git context if git tracking worked
      if (response.gitContext) {
        expect(response.gitContext).toHaveProperty('branchName');
      }
    }, 10000);
  });

  describe('Legal Document Workflow Git Integration', () => {
    it('should create document workflow with git tracking', async () => {
      const workflowOptions = {
        caseId: testCaseId,
        workflowId: testWorkflowId,
        documentType: 'contract' as const,
        reviewRequired: true,
        trackVersions: true,
        collaborators: ['user1@example.com', 'user2@example.com']
      };

      const workflow = await legalDocumentWorkflowService.createDocumentWorkflow(workflowOptions);

      expect(workflow).toHaveProperty('workflowId');
      expect(workflow).toHaveProperty('documentBranch');
      expect(workflow).toHaveProperty('initialCommit');
      expect(workflow).toHaveProperty('collaborationSetup');
      expect(workflow.workflowId).toBe(testWorkflowId);
      expect(workflow.documentBranch).toContain(testCaseId);
      expect(workflow.initialCommit).toBeTruthy();
    });

    it('should generate document draft with version tracking', async () => {
      const promptTemplate = 'Generate a professional services agreement for legal consulting services';
      const context = {
        caseId: testCaseId,
        clientName: 'Test Client Corp',
        serviceType: 'Legal Consultation',
        duration: '12 months'
      };

      const draft = await legalDocumentWorkflowService.generateDocumentDraft(
        testWorkflowId,
        promptTemplate,
        context
      );

      expect(draft).toHaveProperty('draftContent');
      expect(draft).toHaveProperty('version');
      expect(draft).toHaveProperty('aiModel');
      expect(draft).toHaveProperty('confidence');
      expect(draft.draftContent).toBeTruthy();
      expect(draft.version).toMatch(/^v\\d+$/);
      expect(typeof draft.confidence).toBe('number');
    }, 10000);

    it('should track document history and versions', async () => {
      const history = await legalDocumentWorkflowService.getDocumentHistory(testWorkflowId);

      expect(history).toHaveProperty('versions');
      expect(history).toHaveProperty('totalCommits');
      expect(history).toHaveProperty('collaborators');
      expect(history).toHaveProperty('branches');
      expect(Array.isArray(history.versions)).toBe(true);
      expect(Array.isArray(history.collaborators)).toBe(true);
      expect(Array.isArray(history.branches)).toBe(true);
      expect(typeof history.totalCommits).toBe('number');
    });

    it('should start and manage document review process', async () => {
      const reviewers = ['reviewer1@example.com', 'reviewer2@example.com'];
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const review = await legalDocumentWorkflowService.startDocumentReview(
        testWorkflowId,
        'v1.0',
        reviewers,
        dueDate
      );

      expect(review).toHaveProperty('reviewId');
      expect(review).toHaveProperty('reviewBranch');
      expect(review).toHaveProperty('reviewersNotified');
      expect(review.reviewId).toBeTruthy();
      expect(review.reviewBranch).toContain('review');
      expect(review.reviewersNotified).toBe(true);
    });

    it('should apply document revisions and track changes', async () => {
      const revisions = [
        {
          section: 'Introduction',
          oldContent: 'This agreement...',
          newContent: 'This professional services agreement...',
          author: 'reviewer1@example.com',
          reason: 'Clarify agreement type'
        },
        {
          section: 'Terms',
          oldContent: 'Payment due in 30 days',
          newContent: 'Payment due in 14 days',
          author: 'reviewer2@example.com',
          reason: 'Improve cash flow terms'
        }
      ];

      const result = await legalDocumentWorkflowService.applyDocumentRevisions(
        testWorkflowId,
        'v1.0',
        revisions
      );

      expect(result).toHaveProperty('newVersion');
      expect(result).toHaveProperty('commitHash');
      expect(result).toHaveProperty('changesApplied');
      expect(result.newVersion).toBeTruthy();
      expect(result.commitHash).toBeTruthy();
      expect(result.changesApplied).toBe(revisions.length);
    });

    it('should compare document versions', async () => {
      const comparison = await legalDocumentWorkflowService.compareDocumentVersions(
        testWorkflowId,
        'v1.0',
        'v1.1'
      );

      expect(comparison).toHaveProperty('differences');
      expect(comparison).toHaveProperty('summary');
      expect(comparison).toHaveProperty('significantChanges');
      expect(Array.isArray(comparison.differences)).toBe(true);
      expect(typeof comparison.summary).toBe('string');
      expect(typeof comparison.significantChanges).toBe('boolean');
    });

    it('should finalize document and create archive', async () => {
      const finalization = await legalDocumentWorkflowService.finalizeDocument(
        testWorkflowId,
        'v2.0',
        'approver@example.com'
      );

      expect(finalization).toHaveProperty('finalized');
      expect(finalization).toHaveProperty('mainBranchCommit');
      expect(finalization.finalized).toBe(true);
      expect(finalization.mainBranchCommit).toBeTruthy();

      if (finalization.archiveBranch) {
        expect(finalization.archiveBranch).toContain('archive');
      }
    });

    it('should get collaboration metrics', async () => {
      const metrics = await legalDocumentWorkflowService.getCollaborationMetrics(testWorkflowId);

      expect(metrics).toHaveProperty('totalCollaborators');
      expect(metrics).toHaveProperty('commitsByAuthor');
      expect(metrics).toHaveProperty('reviewCycles');
      expect(metrics).toHaveProperty('averageReviewTime');
      expect(metrics).toHaveProperty('documentTurnaround');
      expect(metrics).toHaveProperty('branchesUsed');

      expect(typeof metrics.totalCollaborators).toBe('number');
      expect(Array.isArray(metrics.commitsByAuthor)).toBe(true);
      expect(typeof metrics.reviewCycles).toBe('number');
      expect(typeof metrics.averageReviewTime).toBe('number');
      expect(typeof metrics.documentTurnaround).toBe('number');
      expect(Array.isArray(metrics.branchesUsed)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle git operations when repository is not available', async () => {
      const _originalGitService = gitService;

      // Temporarily break git by changing to a non-git directory
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-git-test-'));
      process.chdir(tempDir);

      try {
        const status = await gitService.getStatus();
        // Should return default status when git is not available
        expect(status.clean).toBe(true);
        expect(status.currentBranch).toBe('unknown');
      } finally {
        // Restore working directory
        process.chdir(testRepoPath);
        await fs.rmdir(tempDir, { recursive: true }).catch(() => {});
      }
    });

    it('should handle workflow creation with git disabled', async () => {
      const workflowOptions = {
        caseId: `no_git_case_${Date.now()}`,
        workflowId: `no_git_workflow_${Date.now()}`,
        documentType: 'letter' as const,
        reviewRequired: false,
        trackVersions: false // Git tracking disabled
      };

      const workflow = await legalDocumentWorkflowService.createDocumentWorkflow(workflowOptions);

      expect(workflow).toHaveProperty('workflowId');
      expect(workflow.collaborationSetup).toBe(false);
    });

    it('should handle agent task without git tracking', async () => {
      const agentTask = {
        id: `no_git_task_${Date.now()}`,
        type: 'qa' as const,
        complexity: 'low' as const,
        prompt: 'What is the statute of limitations for personal injury claims in the UK?',
        trackInGit: false // Git tracking disabled
      };

      const response = await agentOrchestrator.processTask(agentTask);

      expect(response).toHaveProperty('taskId');
      expect(response).toHaveProperty('result');
      expect(response.gitContext).toBeFalsy();
    });
  });

  describe('Integration with Existing Workflow Systems', () => {
    it('should integrate git context with workflow engine progress reports', async () => {
      const report = await agentWorkflow.getWorkflowStatus();

      expect(report).toHaveProperty('queues');
      expect(report).toHaveProperty('workers');
      expect(report).toHaveProperty('git');

      if (report.git && report.git.available !== false) {
        expect(report.git).toHaveProperty('currentBranch');
        expect(report.git).toHaveProperty('clean');
      }
    });

    it('should provide git context in agent orchestrator health check', async () => {
      const health = await agentOrchestrator.checkSystemHealth();

      expect(health).toHaveProperty('modelsAvailable');
      expect(health).toHaveProperty('activeModels');
      expect(health).toHaveProperty('queueLength');
      expect(health).toHaveProperty('gitStatus');

      if (health.gitStatus) {
        expect(health.gitStatus).toHaveProperty('available');
      }
    });
  });
});
