import * as fs from 'fs';
import * as path from 'path';
import { agentWorkflow, JobType } from './agent-workflow';
import { modelManager } from './model-manager';
import { ukLegalAPIs } from './uk-legal-apis';
const PDFDocument = require('pdfkit');

interface AgentContext {
  caseId: string;
  userId: string;
  previousWork?: any[];
  constraints?: string[];
  deadline?: Date;
}

// Base class for all legal agents
abstract class LegalAgent {
  protected name: string;
  protected model: string;
  protected specialties: string[];

  constructor(name: string, model: string, specialties: string[]) {
    this.name = name;
    this.model = model;
    this.specialties = specialties;
  }

  abstract execute(task: any, context: AgentContext): Promise<any>;

  protected async think(prompt: string): Promise<string> {
    const response = await modelManager.generateResponse(prompt, this.model as any);
    return response.response;
  }

  protected log(message: string) {
    console.log(`[${this.name}] ${message}`);
  }
}

// ============ MAIN ORCHESTRATOR (GPU) ============
export class ChiefLegalOfficer extends LegalAgent {
  constructor() {
    super('Chief Legal Officer', 'main', [
      'case strategy',
      'resource allocation',
      'decision making',
      'quality control',
    ]);
  }

  async execute(task: any, context: AgentContext): Promise<any> {
    this.log(`Analyzing case ${context.caseId} for strategic planning`);

    const strategyPrompt = `
    As Chief Legal Officer, analyze this case and create a comprehensive strategy:

    Case Data: ${JSON.stringify(task.caseData)}
    Previous Work: ${JSON.stringify(context.previousWork)}
    Constraints: ${context.constraints?.join(', ')}
    Deadline: ${context.deadline}

    Provide:
    1. Legal position assessment (strengths/weaknesses)
    2. Recommended strategy with phases
    3. Resource allocation plan (which agents to deploy)
    4. Risk assessment with mitigation strategies
    5. Success probability and key milestones
    6. Immediate actions required
    `;

    const strategy = await this.think(strategyPrompt);

    // Delegate work to specialized agents
    const subTasks = this.createSubTasks(strategy, context);

    // Submit jobs to workflow
    const jobIds = [];
    for (const subTask of subTasks) {
      const jobId = await agentWorkflow.submitJob(subTask);
      jobIds.push(jobId);
    }

    return {
      strategy,
      delegatedTasks: jobIds,
      estimatedCompletion: new Date(Date.now() + 3600000),
      confidence: 0.85,
    };
  }

  private createSubTasks(strategy: string, context: AgentContext): any[] {
    const tasks = [];

    // Parse strategy to identify required work
    if (strategy.includes('research') || strategy.includes('precedent')) {
      tasks.push({
        id: `research-${Date.now()}`,
        type: JobType.CASE_LAW_SEARCH,
        priority: 1,
        data: {
          query: this.extractResearchQuery(strategy),
          caseId: context.caseId,
        },
        metadata: context,
      });
    }

    if (strategy.includes('document') || strategy.includes('draft')) {
      tasks.push({
        id: `document-${Date.now()}`,
        type: JobType.DOCUMENT_GENERATION,
        priority: 2,
        data: {
          requirements: this.extractDocumentRequirements(strategy),
          caseId: context.caseId,
        },
        metadata: context,
      });
    }

    if (strategy.includes('compliance') || strategy.includes('GDPR')) {
      tasks.push({
        id: `compliance-${Date.now()}`,
        type: JobType.GDPR_CHECK,
        priority: 3,
        data: {
          scope: this.extractComplianceScope(strategy),
          caseId: context.caseId,
        },
        metadata: context,
      });
    }

    return tasks;
  }

  private extractResearchQuery(strategy: string): string {
    // Extract key legal issues from strategy
    const matches = strategy.match(/research[^.]+/gi) || [];
    return matches.join(' ');
  }

  private extractDocumentRequirements(strategy: string): string {
    const matches = strategy.match(/document[^.]+|draft[^.]+/gi) || [];
    return matches.join(' ');
  }

  private extractComplianceScope(strategy: string): string {
    const matches = strategy.match(/compliance[^.]+|GDPR[^.]+/gi) || [];
    return matches.join(' ');
  }
}

// ============ RESEARCH SPECIALIST (CPU) ============
export class ResearchSpecialist extends LegalAgent {
  constructor() {
    super('Research Specialist', 'chat', [
      'case law research',
      'legislation analysis',
      'precedent finding',
      'legal interpretation',
    ]);
  }

  async execute(task: any, context: AgentContext): Promise<any> {
    this.log(`Conducting legal research for case ${context.caseId}`);

    // Search multiple sources in parallel
    const [caseLaw, legislation, companyData] = await Promise.all([
      ukLegalAPIs.searchCaseLaw(task.query),
      ukLegalAPIs.searchLegislation(task.query),
      task.companyName ? ukLegalAPIs.searchCompany(task.companyName) : Promise.resolve([]),
    ]);

    // Analyze findings with AI
    const analysisPrompt = `
    Analyze these legal research findings:

    Case Law: ${JSON.stringify(caseLaw.slice(0, 5))}
    Legislation: ${JSON.stringify(legislation.slice(0, 5))}
    Company Data: ${JSON.stringify(companyData)}

    Provide:
    1. Most relevant precedents and their application
    2. Applicable statutory provisions
    3. Legal arguments to make
    4. Counter-arguments to anticipate
    5. Strength of legal position (1-10)
    `;

    const analysis = await this.think(analysisPrompt);

    return {
      caseLaw,
      legislation,
      companyData,
      analysis,
      relevantCitations: this.extractCitations(caseLaw),
      confidence: 0.9,
    };
  }

  private extractCitations(cases: any[]): string[] {
    return cases.map((c) => c.citation).filter((c) => c);
  }
}

// ============ DOCUMENT ANALYST (CPU) ============
export class DocumentAnalyst extends LegalAgent {
  constructor() {
    super('Document Analyst', 'mini', [
      'contract review',
      'document extraction',
      'clause analysis',
      'risk identification',
    ]);
  }

  async execute(task: any, context: AgentContext): Promise<any> {
    this.log(`Analyzing documents for case ${context.caseId}`);

    const analysisPrompt = `
    Analyze this legal document:

    Content: ${task.documentContent}
    Type: ${task.documentType}

    Extract and identify:
    1. Key parties and their obligations
    2. Important dates and deadlines
    3. Financial terms and amounts
    4. Potential breaches or issues
    5. Unusual or problematic clauses
    6. Missing elements that should be present
    `;

    const analysis = await this.think(analysisPrompt);

    // Extract entities for database
    const entities = this.extractEntities(analysis);

    return {
      analysis,
      entities,
      risks: this.identifyRisks(analysis),
      opportunities: this.identifyOpportunities(analysis),
      recommendations: this.generateRecommendations(analysis),
    };
  }

  private extractEntities(analysis: string): any {
    return {
      parties: analysis.match(/party|parties|claimant|defendant|appellant/gi) || [],
      dates: analysis.match(/\d{1,2}[/-]\d{1,2}[/-]\d{4}/g) || [],
      amounts: analysis.match(/£[\d,]+/g) || [],
    };
  }

  private identifyRisks(analysis: string): string[] {
    const risks = [];
    if (analysis.includes('breach')) risks.push('Potential breach identified');
    if (analysis.includes('unclear')) risks.push('Ambiguous terms present');
    if (analysis.includes('missing')) risks.push('Required elements missing');
    return risks;
  }

  private identifyOpportunities(_analysis: string): string[] {
    const opportunities = [];
    if (_analysis.includes('favorable')) opportunities.push('Favorable terms identified');
    if (_analysis.includes('leverage')) opportunities.push('Negotiation leverage available');
    return opportunities;
  }

  private generateRecommendations(_analysis: string): string[] {
    return [
      'Review identified risks with client',
      'Gather supporting documentation',
      'Consider amendment proposals',
    ];
  }
}

// ============ COMPLIANCE OFFICER (CPU) ============
export class ComplianceOfficer extends LegalAgent {
  constructor() {
    super('Compliance Officer', 'mini', [
      'GDPR compliance',
      'SRA regulations',
      'court rules',
      'limitation periods',
    ]);
  }

  async execute(task: any, context: AgentContext): Promise<any> {
    this.log(`Checking compliance for case ${context.caseId}`);

    const compliancePrompt = `
    Perform compliance check:

    Data: ${JSON.stringify(task.data)}
    Type: ${task.checkType}

    Verify:
    1. GDPR compliance (data protection, consent, retention)
    2. SRA regulations compliance
    3. Court procedure rules compliance
    4. Limitation periods and deadlines
    5. Professional conduct requirements
    6. Client money handling rules

    Flag any violations or concerns.
    `;

    const compliance = await this.think(compliancePrompt);

    // Check legal aid eligibility if relevant
    let legalAidStatus = null;
    if (task.clientIncome && task.clientCapital) {
      legalAidStatus = await ukLegalAPIs.checkLegalAidEligibility(
        task.clientIncome,
        task.clientCapital,
        task.caseType,
      );
    }

    return {
      compliant: !compliance.includes('violation'),
      issues: this.extractIssues(compliance),
      recommendations: this.extractRecommendations(compliance),
      deadlines: this.calculateDeadlines(task),
      legalAidStatus,
    };
  }

  private extractIssues(compliance: string): string[] {
    const issues = [];
    if (compliance.includes('GDPR')) issues.push('GDPR compliance issue');
    if (compliance.includes('SRA')) issues.push('SRA regulation concern');
    if (compliance.includes('deadline')) issues.push('Deadline at risk');
    return issues;
  }

  private extractRecommendations(_compliance: string): string[] {
    return [
      'Implement recommended safeguards',
      'Document compliance measures',
      'Schedule regular reviews',
    ];
  }

  private calculateDeadlines(task: any): any[] {
    const deadlines = [];
    const now = new Date();

    // Limitation periods
    if (task.caseType === 'personal_injury') {
      const limitDate = new Date(task.incidentDate);
      limitDate.setFullYear(limitDate.getFullYear() + 3);
      deadlines.push({
        type: 'Limitation Period',
        date: limitDate,
        daysRemaining: Math.floor((limitDate.getTime() - now.getTime()) / 86400000),
      });
    }

    // Court deadlines
    if (task.courtDeadline) {
      deadlines.push({
        type: 'Court Filing',
        date: new Date(task.courtDeadline),
        daysRemaining: Math.floor(
          (new Date(task.courtDeadline).getTime() - now.getTime()) / 86400000,
        ),
      });
    }

    return deadlines;
  }
}

// ============ DOCUMENT GENERATOR (CPU) ============
export class DocumentGenerator extends LegalAgent {
  constructor() {
    super('Document Generator', 'code', [
      'legal drafting',
      'template management',
      'formatting',
      'citation',
    ]);
  }

  async execute(task: any, context: AgentContext): Promise<any> {
    this.log(`Generating documents for case ${context.caseId}`);

    const draftPrompt = `
    Generate a professional legal document:

    Type: ${task.documentType}
    Recipient: ${task.recipient}
    Subject: ${task.subject}
    Facts: ${JSON.stringify(task.facts)}
    Legal Basis: ${JSON.stringify(task.legalBasis)}
    Relief Sought: ${task.relief}

    Use formal UK legal language and proper structure.
    Include all necessary elements for this document type.
    `;

    const content = await this.think(draftPrompt);

    // Generate PDF
    const pdfPath = await this.generatePDF(content, task.documentType, context.caseId);

    // Generate DOCX alternative
    const docxPath = await this.generateDOCX(content, task.documentType, context.caseId);

    return {
      content,
      pdfPath,
      docxPath,
      wordCount: content.split(' ').length,
      citations: this.extractCitations(content),
      metadata: {
        generatedAt: new Date(),
        generatedBy: this.name,
        caseId: context.caseId,
      },
    };
  }

  private async generatePDF(content: string, docType: string, caseId: string): Promise<string> {
    const doc = new PDFDocument();
    const filename = `${docType.replace(/\s+/g, '_')}_${caseId}_${Date.now()}.pdf`;
    const filepath = path.join(process.cwd(), 'generated_documents', filename);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    doc.pipe(fs.createWriteStream(filepath));

    // Add header
    doc
      .fontSize(12)
      .text('STRICTLY PRIVATE & CONFIDENTIAL', 50, 50)
      .fontSize(14)
      .text(docType.toUpperCase(), 50, 80)
      .fontSize(11)
      .text(content, 50, 120, {
        align: 'justify',
        lineGap: 5,
      });

    doc.end();

    return filepath;
  }

  private async generateDOCX(content: string, docType: string, caseId: string): Promise<string> {
    // Placeholder for DOCX generation
    // In production, use a library like docx
    const filename = `${docType.replace(/\s+/g, '_')}_${caseId}_${Date.now()}.docx`;
    const filepath = path.join(process.cwd(), 'generated_documents', filename);

    // For now, save as text
    fs.writeFileSync(filepath.replace('.docx', '.txt'), content);

    return filepath.replace('.docx', '.txt');
  }

  private extractCitations(content: string): string[] {
    const citations = content.match(/\[\d{4}\]\s+[A-Z]+\s+\d+/g) || [];
    return [...new Set(citations)];
  }
}

// ============ CLIENT LIAISON (CPU) ============
export class ClientLiaison extends LegalAgent {
  constructor() {
    super('Client Liaison', 'chat', [
      'client communication',
      'expectation management',
      'updates',
      'explanations',
    ]);
  }

  async execute(task: any, context: AgentContext): Promise<any> {
    this.log(`Preparing client communication for case ${context.caseId}`);

    const communicationPrompt = `
    Create a client-friendly communication:

    Purpose: ${task.purpose}
    Case Status: ${task.caseStatus}
    Recent Developments: ${JSON.stringify(task.developments)}
    Next Steps: ${JSON.stringify(task.nextSteps)}

    Write in:
    1. Clear, non-legal language
    2. Empathetic and supportive tone
    3. Structured format with bullet points
    4. Action items clearly marked
    5. Timeline expectations set

    Avoid legal jargon. Be encouraging but realistic.
    `;

    const message = await this.think(communicationPrompt);

    // Create summary for quick reading
    const summaryPrompt = `
    Create a 2-3 sentence summary of this message:
    ${message}
    `;

    const summary = await this.think(summaryPrompt);

    return {
      fullMessage: message,
      summary,
      tone: 'supportive',
      readingLevel: 'accessible',
      actionItems: this.extractActionItems(message),
      nextContact: this.suggestNextContact(task),
    };
  }

  private extractActionItems(message: string): string[] {
    const items = [];
    const lines = message.split('\n');
    for (const line of lines) {
      if (line.includes('please') || line.includes('need') || line.includes('require')) {
        items.push(line.trim());
      }
    }
    return items;
  }

  private suggestNextContact(_task: any): Date {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }
}

// ============ AGENT FACTORY ============
export class LegalAgentFactory {
  private agents: Map<string, LegalAgent>;

  constructor() {
    this.agents = new Map();
    this.initializeAgents();
  }

  private initializeAgents() {
    this.agents.set('chief', new ChiefLegalOfficer());
    this.agents.set('research', new ResearchSpecialist());
    this.agents.set('document', new DocumentAnalyst());
    this.agents.set('compliance', new ComplianceOfficer());
    this.agents.set('generator', new DocumentGenerator());
    this.agents.set('liaison', new ClientLiaison());
  }

  getAgent(type: string): LegalAgent | undefined {
    return this.agents.get(type);
  }

  getAllAgents(): LegalAgent[] {
    return Array.from(this.agents.values());
  }

  async deployAgent(type: string, task: any, context: AgentContext): Promise<any> {
    const agent = this.getAgent(type);
    if (!agent) {
      throw new Error(`Unknown agent type: ${type}`);
    }

    return agent.execute(task, context);
  }
}

export const legalAgentFactory = new LegalAgentFactory();
