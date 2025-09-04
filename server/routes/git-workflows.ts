import { Router, Request, Response } from 'express';
import { gitService } from '../services/git-service';
import { legalDocumentWorkflowService } from '../services/legal-document-workflow';
import { agentOrchestrator } from '../services/agent-orchestrator';
import { agentWorkflow, JobType as _JobType } from '../services/agent-workflow';
import { workflowEngineService as _workflowEngineService } from '../services/workflow-engine';
import { authMiddleware, requireRole } from '../middleware/auth';
import { structuredLogger, LogCategory } from '../services/structured-logger';

const router = Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * GET /api/git-workflows/status
 * Get comprehensive git status for workflows
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const workflowId = req.query.workflowId as string;
    const caseId = req.query.caseId as string;
    
    const gitContext = await gitService.getWorkflowContext(workflowId, caseId);
    const workflowStatus = await agentWorkflow.getWorkflowStatus();
    
    await structuredLogger.info(
      'Git workflow status requested',
      LogCategory.API_REQUEST,
      {
        userId: req.user?.id,
        metadata: {
          workflowId,
          caseId,
          currentBranch: gitContext.status.currentBranch,
          operation: 'git_workflow_status'
        }
      },
      ['api', 'git', 'workflow', 'status']
    );
    
    res.json({
      success: true,
      data: {
        git: gitContext,
        workflow: workflowStatus,
        summary: {
          currentBranch: gitContext.status.currentBranch,
          isClean: gitContext.status.clean,
          recentCommits: gitContext.recentCommits.length,
          workflowBranches: gitContext.workflowBranches?.length || 0,
          caseCommits: gitContext.caseCommits?.length || 0
        }
      }
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to get git workflow status',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          operation: 'git_workflow_status_failed'
        }
      },
      ['api', 'git', 'workflow', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to get workflow status',
      message: error.message
    });
  }
});

/**
 * POST /api/git-workflows/create-document-workflow
 * Create a new document workflow with git tracking
 */
router.post('/create-document-workflow', requireRole(['solicitor', 'paralegal']), async (req: Request, res: Response) => {
  try {
    const {
      caseId,
      documentType,
      templateId,
      collaborators,
      reviewRequired,
      trackVersions = true
    } = req.body;
    
    if (!caseId || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: caseId, documentType'
      });
    }
    
    const workflow = await legalDocumentWorkflowService.createDocumentWorkflow({
      caseId,
      documentType,
      templateId,
      collaborators: collaborators || [],
      reviewRequired: reviewRequired !== false,
      trackVersions,
      clientId: req.user?.clientId
    });
    
    await structuredLogger.info(
      'Document workflow created with git tracking',
      LogCategory.WORKFLOW_MANAGEMENT,
      {
        userId: req.user?.id,
        metadata: {
          workflowId: workflow.workflowId,
          caseId,
          documentType,
          branchCreated: workflow.documentBranch,
          operation: 'document_workflow_created'
        }
      },
      ['api', 'document', 'workflow', 'created']
    );
    
    res.status(201).json({
      success: true,
      data: workflow
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to create document workflow',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          operation: 'document_workflow_creation_failed'
        }
      },
      ['api', 'document', 'workflow', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to create document workflow',
      message: error.message
    });
  }
});

/**
 * POST /api/git-workflows/generate-draft
 * Generate document draft with AI and git versioning
 */
router.post('/generate-draft', requireRole(['solicitor', 'paralegal']), async (req: Request, res: Response) => {
  try {
    const {
      workflowId,
      promptTemplate,
      context,
      documentType: _documentType = 'general'
    } = req.body;
    
    if (!workflowId || !promptTemplate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workflowId, promptTemplate'
      });
    }
    
    const enhancedContext = {
      ...context,
      userId: req.user?.id,
      userRole: req.user?.role,
      generatedAt: new Date().toISOString()
    };
    
    const draft = await legalDocumentWorkflowService.generateDocumentDraft(
      workflowId,
      promptTemplate,
      enhancedContext
    );
    
    await structuredLogger.info(
      'Document draft generated with git versioning',
      LogCategory.AI_SERVICE,
      {
        userId: req.user?.id,
        metadata: {
          workflowId,
          version: draft.version,
          aiModel: draft.aiModel,
          confidence: draft.confidence,
          commitHash: draft.commitHash,
          operation: 'document_draft_generated'
        }
      },
      ['api', 'document', 'draft', 'generated']
    );
    
    res.json({
      success: true,
      data: {
        ...draft,
        draftContent: draft.draftContent.substring(0, 500) + '...', // Truncate for API response
        fullContentAvailable: true
      }
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to generate document draft',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          operation: 'document_draft_generation_failed'
        }
      },
      ['api', 'document', 'draft', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate document draft',
      message: error.message
    });
  }
});

/**
 * POST /api/git-workflows/start-review
 * Start document review process with git branching
 */
router.post('/start-review', requireRole(['solicitor', 'partner']), async (req: Request, res: Response) => {
  try {
    const {
      workflowId,
      documentVersion,
      reviewers,
      dueDate
    } = req.body;
    
    if (!workflowId || !documentVersion || !reviewers) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workflowId, documentVersion, reviewers'
      });
    }
    
    const review = await legalDocumentWorkflowService.startDocumentReview(
      workflowId,
      documentVersion,
      Array.isArray(reviewers) ? reviewers : [reviewers],
      dueDate ? new Date(dueDate) : undefined
    );
    
    await structuredLogger.info(
      'Document review process started',
      LogCategory.WORKFLOW_MANAGEMENT,
      {
        userId: req.user?.id,
        metadata: {
          workflowId,
          documentVersion,
          reviewId: review.reviewId,
          reviewBranch: review.reviewBranch,
          reviewersCount: reviewers.length,
          operation: 'document_review_started'
        }
      },
      ['api', 'document', 'review', 'started']
    );
    
    res.json({
      success: true,
      data: review
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to start document review',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          operation: 'document_review_start_failed'
        }
      },
      ['api', 'document', 'review', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to start document review',
      message: error.message
    });
  }
});

/**
 * POST /api/git-workflows/apply-revisions
 * Apply document revisions and track changes in git
 */
router.post('/apply-revisions', requireRole(['solicitor', 'paralegal']), async (req: Request, res: Response) => {
  try {
    const {
      workflowId,
      currentVersion,
      revisions
    } = req.body;
    
    if (!workflowId || !currentVersion || !revisions || !Array.isArray(revisions)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workflowId, currentVersion, revisions (array)'
      });
    }
    
    // Add author information to revisions
    const enhancedRevisions = revisions.map((revision: any) => ({
      ...revision,
      author: revision.author || req.user?.email || req.user?.id || 'unknown'
    }));
    
    const result = await legalDocumentWorkflowService.applyDocumentRevisions(
      workflowId,
      currentVersion,
      enhancedRevisions
    );
    
    await structuredLogger.info(
      'Document revisions applied',
      LogCategory.WORKFLOW_MANAGEMENT,
      {
        userId: req.user?.id,
        metadata: {
          workflowId,
          currentVersion,
          newVersion: result.newVersion,
          revisionsApplied: result.changesApplied,
          commitHash: result.commitHash,
          operation: 'document_revisions_applied'
        }
      },
      ['api', 'document', 'revisions', 'applied']
    );
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to apply document revisions',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          operation: 'document_revisions_failed'
        }
      },
      ['api', 'document', 'revisions', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to apply document revisions',
      message: error.message
    });
  }
});

/**
 * GET /api/git-workflows/document-history/:workflowId
 * Get complete document history and version information
 */
router.get('/document-history/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    
    const history = await legalDocumentWorkflowService.getDocumentHistory(workflowId);
    
    await structuredLogger.debug(
      'Document history retrieved',
      LogCategory.VERSION_CONTROL,
      {
        userId: req.user?.id,
        metadata: {
          workflowId,
          versionsFound: history.versions.length,
          collaborators: history.collaborators.length,
          operation: 'document_history_retrieved'
        }
      },
      ['api', 'document', 'history', 'retrieved']
    );
    
    res.json({
      success: true,
      data: history
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to get document history',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          workflowId: req.params.workflowId,
          operation: 'document_history_failed'
        }
      },
      ['api', 'document', 'history', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to get document history',
      message: error.message
    });
  }
});

/**
 * POST /api/git-workflows/compare-versions
 * Compare two document versions
 */
router.post('/compare-versions', async (req: Request, res: Response) => {
  try {
    const {
      workflowId,
      version1,
      version2
    } = req.body;
    
    if (!workflowId || !version1 || !version2) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workflowId, version1, version2'
      });
    }
    
    const comparison = await legalDocumentWorkflowService.compareDocumentVersions(
      workflowId,
      version1,
      version2
    );
    
    await structuredLogger.debug(
      'Document versions compared',
      LogCategory.VERSION_CONTROL,
      {
        userId: req.user?.id,
        metadata: {
          workflowId,
          version1,
          version2,
          differencesFound: comparison.differences.length,
          significantChanges: comparison.significantChanges,
          operation: 'document_versions_compared'
        }
      },
      ['api', 'document', 'compare', 'completed']
    );
    
    res.json({
      success: true,
      data: comparison
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to compare document versions',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          operation: 'document_compare_failed'
        }
      },
      ['api', 'document', 'compare', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to compare document versions',
      message: error.message
    });
  }
});

/**
 * POST /api/git-workflows/finalize-document
 * Finalize document and merge to main workflow
 */
router.post('/finalize-document', requireRole(['partner', 'solicitor']), async (req: Request, res: Response) => {
  try {
    const {
      workflowId,
      finalVersion,
      approvalNotes
    } = req.body;
    
    if (!workflowId || !finalVersion) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workflowId, finalVersion'
      });
    }
    
    const approvedBy = req.user?.email || req.user?.id || 'unknown';
    
    const finalization = await legalDocumentWorkflowService.finalizeDocument(
      workflowId,
      finalVersion,
      approvedBy
    );
    
    await structuredLogger.info(
      'Document finalized and approved',
      LogCategory.WORKFLOW_MANAGEMENT,
      {
        userId: req.user?.id,
        metadata: {
          workflowId,
          finalVersion,
          approvedBy,
          commitHash: finalization.mainBranchCommit,
          archiveBranch: finalization.archiveBranch,
          operation: 'document_finalized'
        }
      },
      ['api', 'document', 'finalized', 'approved']
    );
    
    res.json({
      success: true,
      data: {
        ...finalization,
        approvedBy,
        approvalNotes,
        finalizedAt: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to finalize document',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          operation: 'document_finalization_failed'
        }
      },
      ['api', 'document', 'finalize', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to finalize document',
      message: error.message
    });
  }
});

/**
 * GET /api/git-workflows/collaboration-metrics/:workflowId
 * Get collaboration metrics for document workflow
 */
router.get('/collaboration-metrics/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    
    const metrics = await legalDocumentWorkflowService.getCollaborationMetrics(workflowId);
    const collaborationContext = await agentOrchestrator.getCollaborationContext(
      req.query.caseId as string,
      workflowId
    );
    
    const enhancedMetrics = {
      ...metrics,
      collaboration: collaborationContext,
      efficiency: {
        commitsPerCollaborator: metrics.totalCollaborators > 0 
          ? metrics.commitsByAuthor.reduce((sum, c) => sum + c.commits, 0) / metrics.totalCollaborators 
          : 0,
        reviewEfficiency: metrics.reviewCycles > 0 
          ? metrics.averageReviewTime / metrics.reviewCycles 
          : 0,
        overallProductivity: metrics.documentTurnaround > 0 
          ? (metrics.reviewCycles / metrics.documentTurnaround) * 24 
          : 0
      }
    };
    
    await structuredLogger.debug(
      'Collaboration metrics retrieved',
      LogCategory.WORKFLOW_MANAGEMENT,
      {
        userId: req.user?.id,
        metadata: {
          workflowId,
          totalCollaborators: metrics.totalCollaborators,
          reviewCycles: metrics.reviewCycles,
          operation: 'collaboration_metrics_retrieved'
        }
      },
      ['api', 'collaboration', 'metrics', 'retrieved']
    );
    
    res.json({
      success: true,
      data: enhancedMetrics
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to get collaboration metrics',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          workflowId: req.params.workflowId,
          operation: 'collaboration_metrics_failed'
        }
      },
      ['api', 'collaboration', 'metrics', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to get collaboration metrics',
      message: error.message
    });
  }
});

/**
 * POST /api/git-workflows/agent-task-with-git
 * Execute agent task with git context and versioning
 */
router.post('/agent-task-with-git', requireRole(['solicitor', 'paralegal']), async (req: Request, res: Response) => {
  try {
    const {
      taskType,
      complexity = 'medium',
      prompt,
      context,
      workflowId,
      caseId,
      trackInGit = true
    } = req.body;
    
    if (!taskType || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: taskType, prompt'
      });
    }
    
    const agentTask = {
      id: `agent_task_${Date.now()}`,
      type: taskType,
      complexity,
      context: JSON.stringify({
        ...context,
        userId: req.user?.id,
        userRole: req.user?.role
      }),
      prompt,
      userId: req.user?.id,
      caseId,
      workflowId,
      trackInGit
    };
    
    const response = await agentOrchestrator.processTask(agentTask);
    
    await structuredLogger.info(
      'Agent task completed with git context',
      LogCategory.AI_SERVICE,
      {
        userId: req.user?.id,
        metadata: {
          taskId: response.taskId,
          taskType,
          processingTime: response.processingTime,
          confidence: response.confidence,
          gitTracked: trackInGit,
          commitHash: response.gitContext?.commitHash,
          operation: 'agent_task_with_git_completed'
        }
      },
      ['api', 'agent', 'task', 'git-tracked']
    );
    
    res.json({
      success: true,
      data: {
        taskId: response.taskId,
        result: response.result,
        model: response.model,
        processingTime: response.processingTime,
        confidence: response.confidence,
        gitContext: response.gitContext,
        versionControlled: !!response.gitContext?.commitHash
      }
    });
    
  } catch (error: any) {
    await structuredLogger.error(
      'Failed to execute agent task with git',
      LogCategory.API_ERROR,
      error,
      {
        userId: req.user?.id,
        metadata: {
          operation: 'agent_task_with_git_failed'
        }
      },
      ['api', 'agent', 'task', 'error']
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to execute agent task',
      message: error.message
    });
  }
});

export default router;
