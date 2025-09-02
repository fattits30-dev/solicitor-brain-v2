import { Router, Request, Response } from 'express';
import { agentWorkflow, JobType } from '../services/agent-workflow';
import { legalAgentFactory } from '../services/legal-agent-workers';
import { ukLegalAPIs } from '../services/uk-legal-apis';
import { modelManager } from '../services/model-manager';
import { Pool } from 'pg';

const router = Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ============ WORKFLOW STATUS ============
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await agentWorkflow.getWorkflowStatus();
    const modelAvailability = await modelManager.checkModelAvailability();
    
    res.json({
      workflow: status,
      models: Object.fromEntries(modelAvailability),
      agents: legalAgentFactory.getAllAgents().map(a => ({
        name: (a as any).name,
        model: (a as any).model,
        specialties: (a as any).specialties
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SUBMIT NEW CASE FOR ANALYSIS ============
router.post('/analyze-case', async (req: Request, res: Response) => {
  try {
    const { caseData, userId } = req.body;
    
    // Store case in database
    const caseResult = await pool.query(
      `INSERT INTO cases (title, description, status, user_id, metadata) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [
        caseData.title || 'New Case',
        caseData.description || '',
        'analyzing',
        userId || 'system',
        JSON.stringify(caseData)
      ]
    );
    
    const caseId = caseResult.rows[0].id;
    
    // Submit to workflow
    const jobId = await agentWorkflow.submitJob({
      id: `case-${caseId}`,
      type: JobType.CASE_ANALYSIS,
      priority: 1,
      data: { caseData, caseId },
      metadata: {
        userId,
        caseId
      }
    });
    
    // Deploy Chief Legal Officer
    const chiefResponse = await legalAgentFactory.deployAgent(
      'chief',
      { caseData },
      { caseId, userId }
    );
    
    res.json({
      caseId,
      jobId,
      status: 'analyzing',
      chiefAnalysis: chiefResponse,
      message: 'Case analysis started. Chief Legal Officer is reviewing.'
    });
  } catch (error: any) {
    console.error('Case analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ LEGAL RESEARCH ============
router.post('/research', async (req: Request, res: Response) => {
  try {
    const { query, caseId, researchType } = req.body;
    
    // Deploy Research Specialist
    const researchResult = await legalAgentFactory.deployAgent(
      'research',
      { 
        query,
        researchType,
        companyName: req.body.companyName 
      },
      { 
        caseId: caseId || 'direct-research',
        userId: req.body.userId || 'system'
      }
    );
    
    // Store research in database
    if (caseId) {
      await pool.query(
        `INSERT INTO case_research (case_id, query, results, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        [caseId, query, JSON.stringify(researchResult)]
      );
    }
    
    res.json({
      research: researchResult,
      citations: researchResult.relevantCitations,
      confidence: researchResult.confidence
    });
  } catch (error: any) {
    console.error('Research error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DOCUMENT GENERATION ============
router.post('/generate-document', async (req: Request, res: Response) => {
  try {
    const { 
      documentType,
      caseId,
      recipient,
      subject,
      facts,
      legalBasis,
      relief
    } = req.body;
    
    // Deploy Document Generator
    const documentResult = await legalAgentFactory.deployAgent(
      'generator',
      {
        documentType,
        recipient,
        subject,
        facts,
        legalBasis,
        relief
      },
      {
        caseId: caseId || 'standalone-doc',
        userId: req.body.userId || 'system'
      }
    );
    
    // Store document metadata in database
    if (caseId) {
      await pool.query(
        `INSERT INTO documents (case_id, type, content, file_path, metadata, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          caseId,
          documentType,
          documentResult.content,
          documentResult.pdfPath,
          JSON.stringify(documentResult.metadata)
        ]
      );
    }
    
    res.json({
      document: documentResult,
      pdfPath: documentResult.pdfPath,
      wordCount: documentResult.wordCount,
      message: 'Document generated successfully'
    });
  } catch (error: any) {
    console.error('Document generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ COMPLIANCE CHECK ============
router.post('/check-compliance', async (req: Request, res: Response) => {
  try {
    const { caseId, checkType, data } = req.body;
    
    // Deploy Compliance Officer
    const complianceResult = await legalAgentFactory.deployAgent(
      'compliance',
      {
        checkType,
        data,
        clientIncome: req.body.clientIncome,
        clientCapital: req.body.clientCapital,
        caseType: req.body.caseType
      },
      {
        caseId: caseId || 'compliance-check',
        userId: req.body.userId || 'system'
      }
    );
    
    res.json({
      compliant: complianceResult.compliant,
      issues: complianceResult.issues,
      recommendations: complianceResult.recommendations,
      deadlines: complianceResult.deadlines,
      legalAidStatus: complianceResult.legalAidStatus
    });
  } catch (error: any) {
    console.error('Compliance check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ UK LEGAL API SEARCHES ============
router.get('/companies/:query', async (req: Request, res: Response) => {
  try {
    const results = await ukLegalAPIs.searchCompany(req.params.query);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/company/:number', async (req: Request, res: Response) => {
  try {
    const details = await ukLegalAPIs.getCompanyDetails(req.params.number);
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/legislation/:query', async (req: Request, res: Response) => {
  try {
    const results = await ukLegalAPIs.searchLegislation(req.params.query);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/case-law/:query', async (req: Request, res: Response) => {
  try {
    const results = await ukLegalAPIs.searchCaseLaw(req.params.query);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/courts/:name', async (req: Request, res: Response) => {
  try {
    const details = await ukLegalAPIs.getCourtDetails(req.params.name);
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/legal-aid-check', async (req: Request, res: Response) => {
  try {
    const { income, capital, caseType } = req.body;
    const eligibility = await ukLegalAPIs.checkLegalAidEligibility(
      income,
      capital,
      caseType
    );
    res.json(eligibility);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WORKFLOW ORCHESTRATION ============
router.post('/orchestrate', async (req: Request, res: Response) => {
  try {
    const { caseId, workflow } = req.body;
    
    // This endpoint orchestrates a complete legal workflow
    const steps = [];
    
    // Step 1: Chief analyzes
    steps.push({
      step: 'analysis',
      result: await legalAgentFactory.deployAgent(
        'chief',
        { caseData: workflow.caseData },
        { caseId, userId: req.body.userId }
      )
    });
    
    // Step 2: Research conducts investigation
    steps.push({
      step: 'research',
      result: await legalAgentFactory.deployAgent(
        'research',
        { query: workflow.researchQuery },
        { caseId, userId: req.body.userId }
      )
    });
    
    // Step 3: Compliance checks
    steps.push({
      step: 'compliance',
      result: await legalAgentFactory.deployAgent(
        'compliance',
        { 
          checkType: 'comprehensive',
          data: workflow.caseData 
        },
        { caseId, userId: req.body.userId }
      )
    });
    
    // Step 4: Generate documents
    if (workflow.documentsNeeded) {
      for (const docType of workflow.documentsNeeded) {
        steps.push({
          step: `document_${docType}`,
          result: await legalAgentFactory.deployAgent(
            'generator',
            {
              documentType: docType,
              ...workflow.documentData
            },
            { caseId, userId: req.body.userId }
          )
        });
      }
    }
    
    // Step 5: Client communication
    steps.push({
      step: 'client_update',
      result: await legalAgentFactory.deployAgent(
        'liaison',
        {
          purpose: 'case_update',
          caseStatus: 'analysis_complete',
          developments: steps.map(s => s.step),
          nextSteps: workflow.nextSteps || []
        },
        { caseId, userId: req.body.userId }
      )
    });
    
    res.json({
      caseId,
      workflow: 'complete',
      steps,
      totalTime: Date.now() - req.body.startTime,
      success: true
    });
  } catch (error: any) {
    console.error('Orchestration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ JOB STATUS ============
router.get('/job/:jobId', async (req: Request, res: Response) => {
  try {
    // Get job status from queue
    const queues = ['main-orchestrator', 'legal-research', 'document-processor', 
                    'compliance-checker', 'api-integrator', 'data-processor'];
    
    for (const queueName of queues) {
      const queue = (agentWorkflow as any).queues.get(queueName);
      if (queue) {
        const job = await queue.getJob(req.params.jobId);
        if (job) {
          return res.json({
            id: job.id,
            status: await job.getState(),
            progress: job.progress,
            data: job.data,
            result: job.returnvalue,
            failedReason: job.failedReason
          });
        }
      }
    }
    
    res.status(404).json({ error: 'Job not found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;