import { structuredLogger, LogCategory } from './structured-logger';

export interface GitStatus {
  clean: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  currentBranch: string;
  ahead?: number;
  behind?: number;
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  files?: string[];
}

export interface GitDiffInfo {
  file: string;
  additions: number;
  deletions: number;
  content?: string;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  remote?: string;
}

/**
 * Git service wrapper using MCP git tools for legal document management
 * and case tracking with comprehensive version control context
 */
export class GitService {
  private repoPath: string;

  constructor(repoPath?: string) {
    this.repoPath = repoPath || process.cwd();
  }

  /**
   * Get comprehensive repository status
   */
  async getStatus(): Promise<GitStatus> {
    try {
      const { mcp__git__git_status } = require('../utils/mcp-client');
      const statusResult = await mcp__git__git_status({ repo_path: this.repoPath });
      
      await structuredLogger.debug(
        'Git status retrieved',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            operation: 'git_status',
            clean: statusResult.clean || false
          }
        },
        ['git', 'status', 'retrieved']
      );

      return this.parseGitStatus(statusResult.output || '');
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to get git status',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            operation: 'git_status_failed'
          }
        },
        ['git', 'status', 'error']
      );
      
      // Return default status if git is not available
      return {
        clean: true,
        staged: [],
        unstaged: [],
        untracked: [],
        currentBranch: 'unknown'
      };
    }
  }

  /**
   * Get differences in unstaged files
   */
  async getDiffUnstaged(contextLines: number = 3): Promise<GitDiffInfo[]> {
    try {
      const { mcp__git__git_diff_unstaged } = require('../utils/mcp-client');
      const diffResult = await mcp__git__git_diff_unstaged({ 
        repo_path: this.repoPath,
        context_lines: contextLines
      });
      
      const diffs = this.parseDiffOutput(diffResult.output || '');
      
      await structuredLogger.debug(
        'Git unstaged diff retrieved',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            filesChanged: diffs.length,
            operation: 'git_diff_unstaged'
          }
        },
        ['git', 'diff', 'unstaged']
      );

      return diffs;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to get unstaged diff',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            operation: 'git_diff_unstaged_failed'
          }
        },
        ['git', 'diff', 'error']
      );
      return [];
    }
  }

  /**
   * Get differences in staged files
   */
  async getDiffStaged(contextLines: number = 3): Promise<GitDiffInfo[]> {
    try {
      const { mcp__git__git_diff_staged } = require('../utils/mcp-client');
      const diffResult = await mcp__git__git_diff_staged({ 
        repo_path: this.repoPath,
        context_lines: contextLines
      });
      
      const diffs = this.parseDiffOutput(diffResult.output || '');
      
      await structuredLogger.debug(
        'Git staged diff retrieved',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            filesChanged: diffs.length,
            operation: 'git_diff_staged'
          }
        },
        ['git', 'diff', 'staged']
      );

      return diffs;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to get staged diff',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            operation: 'git_diff_staged_failed'
          }
        },
        ['git', 'diff', 'error']
      );
      return [];
    }
  }

  /**
   * Get commit history with optional limit
   */
  async getCommitHistory(maxCount: number = 10): Promise<GitCommitInfo[]> {
    try {
      const { mcp__git__git_log } = require('../utils/mcp-client');
      const logResult = await mcp__git__git_log({ 
        repo_path: this.repoPath,
        max_count: maxCount
      });
      
      const commits = this.parseLogOutput(logResult.output || '');
      
      await structuredLogger.debug(
        'Git commit history retrieved',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            commitsRetrieved: commits.length,
            maxCount,
            operation: 'git_log'
          }
        },
        ['git', 'log', 'retrieved']
      );

      return commits;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to get commit history',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            maxCount,
            operation: 'git_log_failed'
          }
        },
        ['git', 'log', 'error']
      );
      return [];
    }
  }

  /**
   * Add files to staging area
   */
  async addFiles(files: string[]): Promise<boolean> {
    try {
      const { mcp__git__git_add } = require('../utils/mcp-client');
      await mcp__git__git_add({ 
        repo_path: this.repoPath,
        files: files
      });
      
      await structuredLogger.info(
        'Files added to git staging area',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            filesAdded: files.length,
            files: files.join(', '),
            operation: 'git_add'
          }
        },
        ['git', 'add', 'success']
      );

      return true;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to add files to git',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            files: files.join(', '),
            operation: 'git_add_failed'
          }
        },
        ['git', 'add', 'error']
      );
      return false;
    }
  }

  /**
   * Commit staged changes with message
   */
  async commit(message: string, workflowId?: string, caseId?: string): Promise<string | null> {
    try {
      const { mcp__git__git_commit } = require('../utils/mcp-client');
      
      // Enhance commit message with workflow and case context
      let enhancedMessage = message;
      if (workflowId || caseId) {
        const contextParts = [];
        if (workflowId) contextParts.push(`Workflow: ${workflowId}`);
        if (caseId) contextParts.push(`Case: ${caseId}`);
        enhancedMessage = `${message}\n\n${contextParts.join(', ')}`;
      }

      const commitResult = await mcp__git__git_commit({ 
        repo_path: this.repoPath,
        message: enhancedMessage
      });
      
      const commitHash = this.extractCommitHash(commitResult.output || '');
      
      await structuredLogger.info(
        'Git commit created successfully',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            commitHash,
            message: enhancedMessage,
            workflowId,
            caseId,
            operation: 'git_commit'
          }
        },
        ['git', 'commit', 'success']
      );

      return commitHash;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to create git commit',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            message,
            workflowId,
            caseId,
            operation: 'git_commit_failed'
          }
        },
        ['git', 'commit', 'error']
      );
      return null;
    }
  }

  /**
   * Create a new branch for case or workflow isolation
   */
  async createBranch(branchName: string, baseBranch?: string): Promise<boolean> {
    try {
      const { mcp__git__git_create_branch } = require('../utils/mcp-client');
      await mcp__git__git_create_branch({ 
        repo_path: this.repoPath,
        branch_name: branchName,
        base_branch: baseBranch
      });
      
      await structuredLogger.info(
        'Git branch created successfully',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            branchName,
            baseBranch,
            operation: 'git_create_branch'
          }
        },
        ['git', 'branch', 'created']
      );

      return true;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to create git branch',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            branchName,
            baseBranch,
            operation: 'git_create_branch_failed'
          }
        },
        ['git', 'branch', 'error']
      );
      return false;
    }
  }

  /**
   * Switch to a different branch
   */
  async checkoutBranch(branchName: string): Promise<boolean> {
    try {
      const { mcp__git__git_checkout } = require('../utils/mcp-client');
      await mcp__git__git_checkout({ 
        repo_path: this.repoPath,
        branch_name: branchName
      });
      
      await structuredLogger.info(
        'Git branch checkout successful',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            branchName,
            operation: 'git_checkout'
          }
        },
        ['git', 'checkout', 'success']
      );

      return true;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to checkout git branch',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            branchName,
            operation: 'git_checkout_failed'
          }
        },
        ['git', 'checkout', 'error']
      );
      return false;
    }
  }

  /**
   * Get list of branches
   */
  async getBranches(type: 'local' | 'remote' | 'all' = 'local'): Promise<GitBranchInfo[]> {
    try {
      const { mcp__git__git_branch } = require('../utils/mcp-client');
      const branchResult = await mcp__git__git_branch({ 
        repo_path: this.repoPath,
        branch_type: type
      });
      
      const branches = this.parseBranchOutput(branchResult.output || '');
      
      await structuredLogger.debug(
        'Git branches retrieved',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            branchType: type,
            branchCount: branches.length,
            operation: 'git_branch'
          }
        },
        ['git', 'branch', 'retrieved']
      );

      return branches;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to get git branches',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            branchType: type,
            operation: 'git_branch_failed'
          }
        },
        ['git', 'branch', 'error']
      );
      return [];
    }
  }

  /**
   * Show details of a specific commit
   */
  async showCommit(revision: string): Promise<GitCommitInfo | null> {
    try {
      const { mcp__git__git_show } = require('../utils/mcp-client');
      const showResult = await mcp__git__git_show({ 
        repo_path: this.repoPath,
        revision: revision
      });
      
      const commit = this.parseShowOutput(showResult.output || '');
      
      await structuredLogger.debug(
        'Git commit details retrieved',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            revision,
            operation: 'git_show'
          }
        },
        ['git', 'show', 'retrieved']
      );

      return commit;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to show git commit',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            revision,
            operation: 'git_show_failed'
          }
        },
        ['git', 'show', 'error']
      );
      return null;
    }
  }

  /**
   * Reset staged changes
   */
  async resetStaged(): Promise<boolean> {
    try {
      const { mcp__git__git_reset } = require('../utils/mcp-client');
      await mcp__git__git_reset({ repo_path: this.repoPath });
      
      await structuredLogger.info(
        'Git staged changes reset successfully',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            repoPath: this.repoPath,
            operation: 'git_reset'
          }
        },
        ['git', 'reset', 'success']
      );

      return true;
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to reset git staged changes',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            operation: 'git_reset_failed'
          }
        },
        ['git', 'reset', 'error']
      );
      return false;
    }
  }

  /**
   * Get version control context for workflow decisions
   */
  async getWorkflowContext(workflowId?: string, caseId?: string): Promise<{
    status: GitStatus;
    recentCommits: GitCommitInfo[];
    unstaged: GitDiffInfo[];
    staged: GitDiffInfo[];
    branches: GitBranchInfo[];
    workflowBranches?: GitBranchInfo[];
    caseCommits?: GitCommitInfo[];
  }> {
    try {
      const [status, recentCommits, unstaged, staged, branches] = await Promise.all([
        this.getStatus(),
        this.getCommitHistory(5),
        this.getDiffUnstaged(),
        this.getDiffStaged(),
        this.getBranches('all')
      ]);

      // Filter workflow-specific or case-specific information
      const workflowBranches = workflowId 
        ? branches.filter(b => b.name.includes(workflowId))
        : undefined;

      const caseCommits = caseId 
        ? recentCommits.filter(c => c.message.includes(caseId))
        : undefined;

      return {
        status,
        recentCommits,
        unstaged,
        staged,
        branches,
        workflowBranches,
        caseCommits
      };
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to get workflow git context',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            repoPath: this.repoPath,
            workflowId,
            caseId,
            operation: 'workflow_context_failed'
          }
        },
        ['git', 'context', 'error']
      );

      // Return minimal context on failure
      return {
        status: {
          clean: true,
          staged: [],
          unstaged: [],
          untracked: [],
          currentBranch: 'unknown'
        },
        recentCommits: [],
        unstaged: [],
        staged: [],
        branches: []
      };
    }
  }

  // Utility methods for parsing git output

  private parseGitStatus(output: string): GitStatus {
    const lines = output.split('\n');
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];
    let currentBranch = 'unknown';
    let clean = true;

    for (const line of lines) {
      if (line.startsWith('On branch ')) {
        currentBranch = line.substring(10);
      } else if (line.startsWith('A  ')) {
        staged.push(line.substring(3));
        clean = false;
      } else if (line.startsWith(' M ')) {
        unstaged.push(line.substring(3));
        clean = false;
      } else if (line.startsWith('?? ')) {
        untracked.push(line.substring(3));
        clean = false;
      }
    }

    return {
      clean,
      staged,
      unstaged,
      untracked,
      currentBranch
    };
  }

  private parseDiffOutput(output: string): GitDiffInfo[] {
    const diffs: GitDiffInfo[] = [];
    const files = output.split('diff --git');
    
    for (const fileContent of files) {
      if (!fileContent.trim()) continue;
      
      const lines = fileContent.split('\n');
      const fileLine = lines.find(l => l.startsWith('a/') || l.startsWith('+++'));
      if (!fileLine) continue;
      
      const fileName = fileLine.includes('+++') 
        ? fileLine.replace('+++', '').trim()
        : fileLine.split(' ')[0].substring(2);
      
      const additions = (fileContent.match(/^\+/gm) || []).length;
      const deletions = (fileContent.match(/^-/gm) || []).length;
      
      diffs.push({
        file: fileName,
        additions,
        deletions,
        content: fileContent
      });
    }
    
    return diffs;
  }

  private parseLogOutput(output: string): GitCommitInfo[] {
    const commits: GitCommitInfo[] = [];
    const commitBlocks = output.split('commit ');
    
    for (const block of commitBlocks) {
      if (!block.trim()) continue;
      
      const lines = block.split('\n');
      const hash = lines[0]?.trim();
      const authorLine = lines.find(l => l.startsWith('Author:'));
      const dateLine = lines.find(l => l.startsWith('Date:'));
      const messageLine = lines.find(l => l.trim() && !l.includes(':'));
      
      if (hash && authorLine && dateLine && messageLine) {
        commits.push({
          hash: hash.substring(0, 8),
          author: authorLine.replace('Author:', '').trim(),
          date: dateLine.replace('Date:', '').trim(),
          message: messageLine.trim()
        });
      }
    }
    
    return commits;
  }

  private parseBranchOutput(output: string): GitBranchInfo[] {
    const branches: GitBranchInfo[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const current = line.startsWith('*');
      const name = line.replace('*', '').trim();
      
      if (name) {
        branches.push({
          name,
          current,
          remote: name.includes('remotes/') ? name : undefined
        });
      }
    }
    
    return branches;
  }

  private parseShowOutput(output: string): GitCommitInfo | null {
    const lines = output.split('\n');
    const hash = lines[0]?.replace('commit ', '').trim();
    const authorLine = lines.find(l => l.startsWith('Author:'));
    const dateLine = lines.find(l => l.startsWith('Date:'));
    const messageLine = lines.find(l => l.trim() && !l.includes(':'));
    
    if (hash && authorLine && dateLine && messageLine) {
      return {
        hash: hash.substring(0, 8),
        author: authorLine.replace('Author:', '').trim(),
        date: dateLine.replace('Date:', '').trim(),
        message: messageLine.trim()
      };
    }
    
    return null;
  }

  private extractCommitHash(output: string): string {
    const match = output.match(/\[([a-f0-9]+)\]/);
    return match ? match[1] : 'unknown';
  }
}

// Create singleton instance
export const gitService = new GitService();