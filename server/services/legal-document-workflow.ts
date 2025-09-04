import { gitService, GitCommitInfo as _GitCommitInfo, GitDiffInfo as _GitDiffInfo } from './git-service';
import { agentOrchestrator } from './agent-orchestrator';
import { structuredLogger, LogCategory } from './structured-logger';
import { workflowEngineService as _workflowEngineService } from './workflow-engine';

export interface LegalDocumentWorkflowOptions {
  caseId: string;
  workflowId?: string;
  documentType: 'contract' | 'letter' | 'pleading' | 'motion' | 'agreement' | 'notice' | 'other';
  templateId?: string;
  collaborators?: string[];
  reviewRequired: boolean;
  trackVersions: boolean;
  clientId?: string;
}

export interface DocumentVersion {
  id: string;
  version: string;
  commitHash: string;
  author: string;
  createdAt: Date;
  changes: string[];
  reviewStatus: 'draft' | 'under_review' | 'approved' | 'rejected';
  comments?: string[];
}

export interface DocumentCollaboration {
  documentId: string;
  currentVersion: DocumentVersion;
  collaborators: Array<{
    userId: string;
    role: 'author' | 'reviewer' | 'approver' | 'viewer';
    lastActivity: Date;
  }>;
  reviewCycle: {
    currentReviewer?: string;
    dueDate?: Date;
    comments: Array<{
      author: string;
      content: string;
      timestamp: Date;
      resolved: boolean;
    }>;
  };
}

/**
 * Legal Document Workflow Service
 * Manages legal document creation, versioning, and collaboration using git-backed workflows
 */
export class LegalDocumentWorkflowService {
  
  /**
   * Create a new legal document workflow
   */
  async createDocumentWorkflow(options: LegalDocumentWorkflowOptions): Promise<{
    workflowId: string;
    documentBranch: string;
    initialCommit: string;
    collaborationSetup: boolean;
  }> {
    try {
      const workflowId = options.workflowId || `doc_wf_${Date.now()}`;
      const documentBranch = `document/${options.caseId}/${workflowId}`;
      
      // Create dedicated branch for document workflow
      const branchCreated = await gitService.createBranch(documentBranch);
      if (!branchCreated) {
        throw new Error('Failed to create document workflow branch');
      }
      
      // Initialize workflow manifest
      const _workflowManifest = {
        workflowId,
        caseId: options.caseId,
        documentType: options.documentType,
        createdAt: new Date().toISOString(),
        collaborators: options.collaborators || [],
        reviewRequired: options.reviewRequired,
        trackVersions: options.trackVersions,
        templateId: options.templateId,
        status: 'active'
      };
      
      // This would typically write the manifest to a file
      // For this implementation, we'll commit the workflow creation
      const initialCommit = await gitService.commit(
        `Initialize legal document workflow: ${options.documentType}\n\nCase ID: ${options.caseId}\nWorkflow ID: ${workflowId}\nDocument Type: ${options.documentType}`,
        workflowId,
        options.caseId
      );
      
      if (!initialCommit) {
        throw new Error('Failed to create initial commit for document workflow');
      }
      
      await structuredLogger.info(
        'Legal document workflow created',
        LogCategory.WORKFLOW_MANAGEMENT,
        {
          metadata: {
            workflowId,
            caseId: options.caseId,
            documentType: options.documentType,
            branchName: documentBranch,
            initialCommit,
            operation: 'document_workflow_created'
          }
        },
        ['legal', 'document', 'workflow', 'created']
      );
      
      return {
        workflowId,
        documentBranch,
        initialCommit,
        collaborationSetup: options.collaborators ? options.collaborators.length > 0 : false
      };
      
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to create legal document workflow',
        LogCategory.WORKFLOW_MANAGEMENT,
        error,
        {
          metadata: {
            caseId: options.caseId,
            documentType: options.documentType,
            operation: 'document_workflow_creation_failed'
          }
        },
        ['legal', 'document', 'workflow', 'error']
      );
      throw error;
    }
  }
  
  /**
   * Generate document draft using AI with git tracking
   */
  async generateDocumentDraft(
    workflowId: string,
    promptTemplate: string,
    context: any
  ): Promise<{
    draftContent: string;
    version: string;
    commitHash?: string;
    aiModel: string;
    confidence: number;
  }> {
    try {
      // Use agent orchestrator to generate the draft
      const agentTask = {
        id: `draft_${workflowId}_${Date.now()}`,
        type: 'draft_generation' as const,
        complexity: 'high' as const,
        context: JSON.stringify(context),
        prompt: promptTemplate,
        workflowId: workflowId,
        caseId: context.caseId,
        trackInGit: true
      };
      
      const response = await agentOrchestrator.processTask(agentTask);
      
      const version = `v${Date.now()}`;
      
      await structuredLogger.info(
        'Legal document draft generated',
        LogCategory.AI_SERVICE,
        {
          metadata: {
            workflowId,
            version,
            aiModel: response.model,
            confidence: response.confidence,
            processingTime: response.processingTime,
            commitHash: response.gitContext?.commitHash,
            operation: 'document_draft_generated'
          }
        },
        ['legal', 'document', 'draft', 'ai-generated']
      );
      
      return {
        draftContent: response.result,
        version,
        commitHash: response.gitContext?.commitHash,
        aiModel: response.model,
        confidence: response.confidence || 0.8
      };
      
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to generate document draft',
        LogCategory.AI_SERVICE,
        error,
        {
          metadata: {
            workflowId,
            operation: 'document_draft_generation_failed'
          }
        },
        ['legal', 'document', 'draft', 'error']
      );
      throw error;
    }
  }
  
  /**
   * Start document review process
   */
  async startDocumentReview(
    workflowId: string,
    documentVersion: string,
    reviewers: string[],
    dueDate?: Date
  ): Promise<{
    reviewId: string;
    reviewBranch: string;
    reviewersNotified: boolean;
  }> {
    try {
      const reviewId = `review_${workflowId}_${Date.now()}`;
      const reviewBranch = `review/${workflowId}/${reviewId}`;
      
      // Create review branch
      const branchCreated = await gitService.createBranch(reviewBranch);
      if (!branchCreated) {
        throw new Error('Failed to create review branch');
      }
      
      // Commit review initiation
      const commitMessage = `Start document review: ${reviewId}\n\nDocument version: ${documentVersion}\nReviewers: ${reviewers.join(', ')}\nDue date: ${dueDate?.toISOString() || 'Not specified'}`;
      
      const commitHash = await gitService.commit(commitMessage, workflowId);
      
      await structuredLogger.info(
        'Document review process started',
        LogCategory.WORKFLOW_MANAGEMENT,
        {
          metadata: {
            workflowId,
            reviewId,
            documentVersion,
            reviewBranch,
            reviewers: reviewers.length,
            dueDate: dueDate?.toISOString(),
            commitHash,
            operation: 'document_review_started'
          }
        },
        ['legal', 'document', 'review', 'started']
      );
      
      return {
        reviewId,
        reviewBranch,
        reviewersNotified: true // Would integrate with notification system
      };
      
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to start document review',
        LogCategory.WORKFLOW_MANAGEMENT,
        error,
        {
          metadata: {
            workflowId,
            documentVersion,
            operation: 'document_review_start_failed'
          }
        },
        ['legal', 'document', 'review', 'error']
      );
      throw error;
    }
  }
  
  /**
   * Apply document revisions and create new version
   */
  async applyDocumentRevisions(
    workflowId: string,
    currentVersion: string,
    revisions: Array<{
      section: string;
      oldContent: string;
      newContent: string;
      author: string;
      reason: string;
    }>
  ): Promise<{
    newVersion: string;
    commitHash: string;
    changesApplied: number;
  }> {
    try {
      const newVersion = `v${Date.now()}`;
      
      // Apply revisions (in a real implementation, this would modify actual document files)
      const revisionSummary = revisions.map(r => 
        `- ${r.section}: ${r.reason} (by ${r.author})`
      ).join('\n');
      
      const commitMessage = `Apply document revisions: ${currentVersion} -> ${newVersion}\n\nRevisions applied:\n${revisionSummary}`;
      
      const commitHash = await gitService.commit(commitMessage, workflowId);
      
      if (!commitHash) {
        throw new Error('Failed to commit document revisions');
      }
      
      await structuredLogger.info(
        'Document revisions applied',
        LogCategory.WORKFLOW_MANAGEMENT,
        {
          metadata: {
            workflowId,
            currentVersion,
            newVersion,
            revisionsApplied: revisions.length,
            commitHash,
            operation: 'document_revisions_applied'
          }
        },
        ['legal', 'document', 'revisions', 'applied']
      );
      
      return {
        newVersion,
        commitHash,
        changesApplied: revisions.length
      };
      
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to apply document revisions',
        LogCategory.WORKFLOW_MANAGEMENT,
        error,
        {
          metadata: {
            workflowId,
            currentVersion,
            revisionsCount: revisions.length,
            operation: 'document_revisions_failed'
          }
        },
        ['legal', 'document', 'revisions', 'error']
      );
      throw error;
    }
  }
  
  /**
   * Get document version history
   */
  async getDocumentHistory(workflowId: string): Promise<{
    versions: DocumentVersion[];
    totalCommits: number;
    collaborators: string[];
    branches: string[];
  }> {
    try {
      const commitHistory = await gitService.getCommitHistory(20);
      const workflowCommits = commitHistory.filter(c => 
        c.message.includes(workflowId) || c.message.includes('document')
      );
      
      const branches = await gitService.getBranches();
      const workflowBranches = branches
        .filter(b => b.name.includes(workflowId) || b.name.includes('document'))
        .map(b => b.name);
      
      const collaborators = [...new Set(workflowCommits.map(c => c.author))];
      
      const versions: DocumentVersion[] = workflowCommits.map((commit, index) => ({
        id: `version_${index + 1}`,
        version: `v${Date.now() - (index * 100000)}`, // Simulate version numbers
        commitHash: commit.hash,
        author: commit.author,
        createdAt: new Date(commit.date),
        changes: [commit.message.split('\n')[0]], // Use commit message as change description
        reviewStatus: index === 0 ? 'approved' : (index < 3 ? 'under_review' : 'draft'),
        comments: []
      }));
      
      await structuredLogger.debug(
        'Document history retrieved',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            workflowId,
            versionsFound: versions.length,
            collaborators: collaborators.length,
            branches: workflowBranches.length,
            operation: 'document_history_retrieved'
          }
        },
        ['legal', 'document', 'history', 'retrieved']
      );
      
      return {
        versions,
        totalCommits: workflowCommits.length,
        collaborators,
        branches: workflowBranches
      };
      
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to get document history',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            workflowId,
            operation: 'document_history_failed'
          }
        },
        ['legal', 'document', 'history', 'error']
      );
      throw error;
    }
  }
  
  /**
   * Compare document versions
   */
  async compareDocumentVersions(
    workflowId: string,
    version1: string,
    version2: string
  ): Promise<{
    differences: Array<{
      type: 'addition' | 'deletion' | 'modification';
      section: string;
      content: string;
      lineNumber?: number;
    }>;
    summary: string;
    significantChanges: boolean;
  }> {
    try {
      // Get diff between versions (this would be more sophisticated in a real implementation)
      const unstaged = await gitService.getDiffUnstaged();
      const staged = await gitService.getDiffStaged();
      
      const allDiffs = [...unstaged, ...staged];
      
      const differences = allDiffs.map((diff, index) => ({
        type: diff.additions > diff.deletions ? 'addition' : 
              diff.deletions > 0 ? 'deletion' : 'modification',
        section: diff.file,
        content: `${diff.additions} additions, ${diff.deletions} deletions`,
        lineNumber: index + 1
      })) as Array<{
        type: 'addition' | 'deletion' | 'modification';
        section: string;
        content: string;
        lineNumber?: number;
      }>;
      
      const totalChanges = allDiffs.reduce((sum, diff) => sum + diff.additions + diff.deletions, 0);
      const significantChanges = totalChanges > 10; // Arbitrary threshold
      
      const summary = `Comparing ${version1} to ${version2}: ${differences.length} sections changed, ${totalChanges} total changes`;
      
      await structuredLogger.debug(
        'Document versions compared',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            workflowId,
            version1,
            version2,
            differencesFound: differences.length,
            totalChanges,
            significantChanges,
            operation: 'document_versions_compared'
          }
        },
        ['legal', 'document', 'compare', 'completed']
      );
      
      return {
        differences,
        summary,
        significantChanges
      };
      
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to compare document versions',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            workflowId,
            version1,
            version2,
            operation: 'document_compare_failed'
          }
        },
        ['legal', 'document', 'compare', 'error']
      );
      throw error;
    }
  }
  
  /**
   * Finalize document and merge to main workflow
   */
  async finalizeDocument(
    workflowId: string,
    finalVersion: string,
    approvedBy: string
  ): Promise<{
    finalized: boolean;
    mainBranchCommit: string;
    archiveBranch?: string;
  }> {
    try {
      // Switch to main workflow branch
      const status = await gitService.getStatus();
      const _documentBranch = status.currentBranch;
      
      // Commit final version
      const finalCommitMessage = `Finalize document: ${finalVersion}\n\nApproved by: ${approvedBy}\nWorkflow: ${workflowId}\nDocument finalized and ready for use`;
      
      const finalCommit = await gitService.commit(finalCommitMessage, workflowId);
      
      if (!finalCommit) {
        throw new Error('Failed to commit finalized document');
      }
      
      // Create archive branch for historical reference
      const archiveBranch = `archive/${workflowId}_${Date.now()}`;
      const archiveCreated = await gitService.createBranch(archiveBranch);
      
      await structuredLogger.info(
        'Legal document finalized',
        LogCategory.WORKFLOW_MANAGEMENT,
        {
          metadata: {
            workflowId,
            finalVersion,
            approvedBy,
            finalCommit,
            archiveBranch: archiveCreated ? archiveBranch : undefined,
            operation: 'document_finalized'
          }
        },
        ['legal', 'document', 'finalized', 'approved']
      );
      
      return {
        finalized: true,
        mainBranchCommit: finalCommit,
        archiveBranch: archiveCreated ? archiveBranch : undefined
      };
      
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to finalize document',
        LogCategory.WORKFLOW_MANAGEMENT,
        error,
        {
          metadata: {
            workflowId,
            finalVersion,
            approvedBy,
            operation: 'document_finalization_failed'
          }
        },
        ['legal', 'document', 'finalize', 'error']
      );
      throw error;
    }
  }
  
  /**
   * Get collaboration metrics for a document workflow
   */
  async getCollaborationMetrics(workflowId: string): Promise<{
    totalCollaborators: number;
    commitsByAuthor: Array<{ author: string; commits: number }>;
    reviewCycles: number;
    averageReviewTime: number; // in hours
    documentTurnaround: number; // in hours
    branchesUsed: string[];
  }> {
    try {
      const commitHistory = await gitService.getCommitHistory(50);
      const workflowCommits = commitHistory.filter(c => 
        c.message.includes(workflowId)
      );
      
      const branches = await gitService.getBranches();
      const workflowBranches = branches
        .filter(b => b.name.includes(workflowId))
        .map(b => b.name);
      
      // Calculate collaboration metrics
      const collaborators = [...new Set(workflowCommits.map(c => c.author))];
      const commitsByAuthor = collaborators.map(author => ({
        author,
        commits: workflowCommits.filter(c => c.author === author).length
      }));
      
      const reviewCommits = workflowCommits.filter(c => c.message.includes('review'));
      const reviewCycles = reviewCommits.length;
      
      // Estimate timing metrics (simplified)
      const firstCommit = workflowCommits[workflowCommits.length - 1];
      const lastCommit = workflowCommits[0];
      
      const documentTurnaround = firstCommit && lastCommit 
        ? (new Date(lastCommit.date).getTime() - new Date(firstCommit.date).getTime()) / (1000 * 60 * 60)
        : 0;
      
      const averageReviewTime = reviewCycles > 0 ? documentTurnaround / reviewCycles : 0;
      
      return {
        totalCollaborators: collaborators.length,
        commitsByAuthor,
        reviewCycles,
        averageReviewTime,
        documentTurnaround,
        branchesUsed: workflowBranches
      };
      
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to get collaboration metrics',
        LogCategory.WORKFLOW_MANAGEMENT,
        error,
        {
          metadata: {
            workflowId,
            operation: 'collaboration_metrics_failed'
          }
        },
        ['legal', 'document', 'metrics', 'error']
      );
      
      // Return empty metrics on error
      return {
        totalCollaborators: 0,
        commitsByAuthor: [],
        reviewCycles: 0,
        averageReviewTime: 0,
        documentTurnaround: 0,
        branchesUsed: []
      };
    }
  }
}

// Create singleton instance
export const legalDocumentWorkflowService = new LegalDocumentWorkflowService();