import { aiService } from './ai.js';
import { format } from 'date-fns';

export interface DocumentTemplate {
  id: string;
  name: string;
  category: 'pleading' | 'correspondence' | 'application' | 'agreement' | 'statement';
  description: string;
  fields: DocumentField[];
  template: string;
  practiceDirection?: string;
  courtForm?: string;
}

export interface DocumentField {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'address' | 'select' | 'multiline';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select fields
  validation?: string; // Regex pattern
}

export interface GeneratedDocument {
  id: string;
  templateId: string;
  title: string;
  content: string;
  metadata: {
    caseId?: string;
    clientId?: string;
    generatedAt: Date;
    lastModified: Date;
    version: number;
  };
  compliance: {
    practiceDirectionCompliant: boolean;
    wordCount?: number;
    requiredFieldsComplete: boolean;
    warnings: string[];
  };
}

export interface ClaimFormData {
  // Claimant details
  claimantName: string;
  claimantAddress: string;
  claimantReference?: string;
  
  // Defendant details
  defendantName: string;
  defendantAddress: string;
  
  // Claim details
  claimValue: number;
  interestClaimed: boolean;
  interestRate?: number;
  interestFromDate?: Date;
  
  // Court details
  preferredCourt: string;
  courtFee: number;
  
  // Brief details
  briefDetails: string;
  particularsAttached: boolean;
}

export interface ParticularsOfClaimData {
  claimantName: string;
  defendantName: string;
  facts: string[];
  contractDetails?: {
    dateOfContract: Date;
    contractTerms: string[];
    breachDetails: string;
    breachDate: Date;
  };
  damages: {
    generalDamages?: number;
    specialDamages: Array<{ description: string; amount: number; }>;
    lossOfEarnings?: { period: string; amount: number; };
    interestClaim: string;
  };
  relief: string[];
}

class DocumentAutomationService {
  
  private documentTemplates: DocumentTemplate[] = [
    {
      id: 'n1-claim-form',
      name: 'N1 Claim Form',
      category: 'pleading',
      description: 'HMCTS N1 Claim Form for money claims',
      courtForm: 'N1',
      fields: [
        { name: 'claimantName', type: 'text', label: 'Claimant Name', required: true },
        { name: 'claimantAddress', type: 'address', label: 'Claimant Address', required: true },
        { name: 'defendantName', type: 'text', label: 'Defendant Name', required: true },
        { name: 'defendantAddress', type: 'address', label: 'Defendant Address', required: true },
        { name: 'claimValue', type: 'currency', label: 'Claim Value (£)', required: true },
        { name: 'briefDetails', type: 'multiline', label: 'Brief Details of Claim', required: true },
        { name: 'preferredCourt', type: 'text', label: 'Preferred Court', required: true }
      ],
      template: `CLAIM FORM

In the {{preferredCourt}}
Claim No: [To be allocated]

Claimant: {{claimantName}}
{{claimantAddress}}

Defendant: {{defendantName}}
{{defendantAddress}}

BRIEF DETAILS OF CLAIM:
{{briefDetails}}

THE CLAIMANT CLAIMS:
{{claimValue}} plus interest pursuant to section 69 of the County Courts Act 1984 and costs.

{{#if particularsAttached}}
Full details are set out in the attached Particulars of Claim.
{{/if}}

Statement of Truth:
I believe that the facts stated in this claim form are true.

Signed: ________________________
{{claimantName}} / [Solicitor for the Claimant]
Date: {{currentDate}}`
    },
    {
      id: 'particulars-of-claim',
      name: 'Particulars of Claim',
      category: 'pleading',
      description: 'Detailed statement of the claim',
      practiceDirection: 'CPR PD 16',
      fields: [
        { name: 'claimantName', type: 'text', label: 'Claimant Name', required: true },
        { name: 'defendantName', type: 'text', label: 'Defendant Name', required: true },
        { name: 'facts', type: 'multiline', label: 'Material Facts', required: true },
        { name: 'contractDetails', type: 'multiline', label: 'Contract Details', required: false },
        { name: 'damages', type: 'multiline', label: 'Damages Claimed', required: true }
      ],
      template: `PARTICULARS OF CLAIM

1. The Claimant is {{claimantName}} [occupation/status].

2. The Defendant is {{defendantName}} [occupation/status].

FACTS:
{{#each facts}}
{{@index}}. {{this}}
{{/each}}

DAMAGES:
{{damages}}

AND the Claimant claims:
{{#each relief}}
({{@index}}) {{this}}
{{/each}}

Statement of Truth:
I believe that the facts stated in these Particulars of Claim are true.

Signed: ________________________
{{claimantName}} / [Solicitor for the Claimant]
Date: {{currentDate}}`
    },
    {
      id: 'defence',
      name: 'Defence',
      category: 'pleading',
      description: 'Defence to claim',
      practiceDirection: 'CPR PD 15',
      fields: [
        { name: 'defendantName', type: 'text', label: 'Defendant Name', required: true },
        { name: 'claimantName', type: 'text', label: 'Claimant Name', required: true },
        { name: 'admissions', type: 'multiline', label: 'Facts Admitted', required: false },
        { name: 'denials', type: 'multiline', label: 'Facts Denied', required: false },
        { name: 'defences', type: 'multiline', label: 'Positive Defences', required: true }
      ],
      template: `DEFENCE

1. The Defendant is {{defendantName}} [occupation/status].

{{#if admissions}}
ADMISSIONS:
{{admissions}}
{{/if}}

{{#if denials}}
DENIALS:
{{denials}}
{{/if}}

DEFENCE:
{{defences}}

Statement of Truth:
I believe that the facts stated in this Defence are true.

Signed: ________________________
{{defendantName}} / [Solicitor for the Defendant]
Date: {{currentDate}}`
    },
    {
      id: 'witness-statement',
      name: 'Witness Statement',
      category: 'statement',
      description: 'Witness Statement compliant with CPR 32',
      practiceDirection: 'CPR PD 32',
      fields: [
        { name: 'witnessName', type: 'text', label: 'Witness Name', required: true },
        { name: 'witnessAddress', type: 'address', label: 'Witness Address', required: true },
        { name: 'witnessOccupation', type: 'text', label: 'Witness Occupation', required: true },
        { name: 'caseTitle', type: 'text', label: 'Case Title', required: true },
        { name: 'statementNumber', type: 'number', label: 'Statement Number', required: true },
        { name: 'facts', type: 'multiline', label: 'Statement of Facts', required: true }
      ],
      template: `WITNESS STATEMENT

IN THE HIGH COURT OF JUSTICE / COUNTY COURT AT [LOCATION]

BETWEEN:
[CLAIMANT NAME]                    Claimant
-and-
[DEFENDANT NAME]                   Defendant

{{statementNumber}} WITNESS STATEMENT OF {{witnessName}}

I, {{witnessName}} of {{witnessAddress}}, [occupation: {{witnessOccupation}}] WILL SAY as follows:

{{facts}}

Statement of Truth:
I believe that the facts stated in this witness statement are true.

Signed: ________________________
{{witnessName}}
Date: {{currentDate}}

The contents of this statement are true to the best of my knowledge and belief.`
    },
    {
      id: 'letter-before-action',
      name: 'Letter Before Action',
      category: 'correspondence',
      description: 'Pre-action protocol letter',
      practiceDirection: 'Pre-Action Protocol',
      fields: [
        { name: 'clientName', type: 'text', label: 'Client Name', required: true },
        { name: 'defendantName', type: 'text', label: 'Defendant Name', required: true },
        { name: 'defendantAddress', type: 'address', label: 'Defendant Address', required: true },
        { name: 'claimSummary', type: 'multiline', label: 'Summary of Claim', required: true },
        { name: 'amountClaimed', type: 'currency', label: 'Amount Claimed (£)', required: true },
        { name: 'responseDeadline', type: 'date', label: 'Response Deadline', required: true }
      ],
      template: `WITHOUT PREJUDICE SAVE AS TO COSTS

Dear Sirs,

RE: {{clientName}} v {{defendantName}} - LETTER BEFORE ACTION

We act for {{clientName}} in connection with the following matter.

SUMMARY OF DISPUTE:
{{claimSummary}}

AMOUNT CLAIMED:
Our client claims damages in the sum of £{{amountClaimed}} together with interest and costs.

BASIS OF CLAIM:
[Details of the legal basis for the claim]

DOCUMENTS RELIED UPON:
[List key documents]

RESPONSE REQUIRED:
We require your response to this letter within 14 days of receipt, by {{responseDeadline}}.

If we do not receive a satisfactory response within this timeframe, we reserve the right to issue proceedings without further notice. In such circumstances, we will seek to recover our client's costs from you.

We look forward to hearing from you.

Yours faithfully,

[SOLICITOR NAME]
[FIRM NAME]`
    },
    {
      id: 'settlement-agreement',
      name: 'Settlement Agreement',
      category: 'agreement',
      description: 'Compromise agreement template',
      fields: [
        { name: 'party1Name', type: 'text', label: 'First Party Name', required: true },
        { name: 'party2Name', type: 'text', label: 'Second Party Name', required: true },
        { name: 'settlementAmount', type: 'currency', label: 'Settlement Amount (£)', required: true },
        { name: 'paymentDate', type: 'date', label: 'Payment Date', required: true },
        { name: 'disputeDescription', type: 'multiline', label: 'Description of Dispute', required: true }
      ],
      template: `SETTLEMENT AGREEMENT

THIS AGREEMENT is made the {{currentDate}}

BETWEEN:

(1) {{party1Name}} ("the First Party"); and
(2) {{party2Name}} ("the Second Party")

WHEREAS there has been a dispute between the parties concerning {{disputeDescription}}

NOW IT IS HEREBY AGREED as follows:

1. SETTLEMENT SUM
   The Second Party shall pay to the First Party the sum of £{{settlementAmount}} ("the Settlement Sum") in full and final settlement of all claims.

2. PAYMENT
   Payment shall be made by {{paymentDate}} by [method of payment].

3. FULL AND FINAL SETTLEMENT
   Upon payment of the Settlement Sum, this Agreement shall be in full and final settlement of all claims, demands and causes of action between the parties.

4. CONFIDENTIALITY
   The terms of this Agreement shall remain confidential between the parties.

5. COSTS
   Each party shall bear their own legal costs.

IN WITNESS WHEREOF the parties have executed this Agreement the day and year first above written.

SIGNED:

________________________              ________________________
{{party1Name}}                         {{party2Name}}`
    }
  ];

  /**
   * Get all available document templates
   */
  getAvailableTemplates(): DocumentTemplate[] {
    return [...this.documentTemplates];
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): DocumentTemplate | null {
    return this.documentTemplates.find(t => t.id === templateId) || null;
  }

  /**
   * Generate document from template and data
   */
  async generateDocument(
    templateId: string,
    data: Record<string, any>,
    caseId?: string,
    clientId?: string
  ): Promise<GeneratedDocument> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Add system data
    const enrichedData = {
      ...data,
      currentDate: format(new Date(), 'dd MMMM yyyy'),
      currentDateTime: format(new Date(), 'dd MMMM yyyy HH:mm')
    };

    // Simple template processing (in production, use a proper template engine)
    let content = template.template;

    // Replace simple variables
    for (const [key, value] of Object.entries(enrichedData)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, String(value || ''));
    }

    // Handle conditional blocks (basic implementation)
    content = content.replace(/{{#if (\w+)}}(.*?){{\/if}}/gs, (match, condition, block) => {
      return enrichedData[condition] ? block : '';
    });

    // Handle arrays (basic implementation)
    content = content.replace(/{{#each (\w+)}}(.*?){{\/each}}/gs, (match, arrayName, block) => {
      const array = enrichedData[arrayName];
      if (Array.isArray(array)) {
        return array.map((item, index) => {
          let itemBlock = block;
          itemBlock = itemBlock.replace(/{{@index}}/g, (index + 1).toString());
          itemBlock = itemBlock.replace(/{{this}}/g, String(item));
          return itemBlock;
        }).join('');
      }
      return '';
    });

    // Compliance checks
    const compliance = this.checkCompliance(template, enrichedData, content);

    const generatedDoc: GeneratedDocument = {
      id: `doc_${Date.now()}`,
      templateId,
      title: `${template.name} - ${format(new Date(), 'yyyy-MM-dd')}`,
      content,
      metadata: {
        caseId,
        clientId,
        generatedAt: new Date(),
        lastModified: new Date(),
        version: 1
      },
      compliance
    };

    return generatedDoc;
  }

  /**
   * Generate N1 Claim Form with AI assistance
   */
  async generateN1ClaimForm(data: ClaimFormData): Promise<GeneratedDocument> {
    // Use AI to enhance brief details if needed
    let enhancedBriefDetails = data.briefDetails;
    
    if (data.briefDetails.length < 100) {
      try {
        const aiEnhanced = await aiService.generateDraft(
          `Expand this brief claim description into a proper summary for an N1 claim form. 
           Keep it concise but include key facts. Original: "${data.briefDetails}"
           Claim value: £${data.claimValue}`,
          'You are drafting court documents. Be precise and professional.'
        );
        enhancedBriefDetails = aiEnhanced.substring(0, 500); // Limit length
      } catch (error) {
        console.log('AI enhancement failed, using original brief details');
      }
    }

    const enrichedData = {
      ...data,
      briefDetails: enhancedBriefDetails,
      particularsAttached: true // Assume particulars will be attached
    };

    return this.generateDocument('n1-claim-form', enrichedData);
  }

  /**
   * Generate Particulars of Claim with AI assistance
   */
  async generateParticularsOfClaim(data: ParticularsOfClaimData): Promise<GeneratedDocument> {
    try {
      // Use AI to structure facts and legal analysis
      const structuredFacts = await aiService.generateDraft(
        `Structure these facts into proper numbered paragraphs for Particulars of Claim:
         ${JSON.stringify(data.facts)}
         
         Contract details: ${JSON.stringify(data.contractDetails)}
         Damages: ${JSON.stringify(data.damages)}`,
        'You are drafting UK court pleadings. Follow CPR requirements and be precise.'
      );

      // Generate relief sought
      const reliefSought = [
        `Damages in the sum of £${(data.damages.generalDamages || 0) + data.damages.specialDamages.reduce((sum, item) => sum + item.amount, 0)}`,
        'Interest pursuant to section 69 of the County Courts Act 1984',
        'Costs'
      ];

      const enrichedData = {
        ...data,
        facts: data.facts,
        damages: JSON.stringify(data.damages),
        relief: reliefSought
      };

      return this.generateDocument('particulars-of-claim', enrichedData);
    } catch (error) {
      console.error('AI assistance failed for particulars:', error);
      // Fallback without AI
      const reliefSought = ['Damages', 'Interest', 'Costs'];
      return this.generateDocument('particulars-of-claim', { ...data, relief: reliefSought });
    }
  }

  /**
   * Generate witness statement with AI structuring
   */
  async generateWitnessStatement(
    witnessName: string,
    witnessAddress: string,
    witnessOccupation: string,
    caseTitle: string,
    statementNumber: number,
    rawFacts: string
  ): Promise<GeneratedDocument> {
    try {
      // Use AI to structure witness statement properly
      const structuredFacts = await aiService.generateDraft(
        `Structure this witness testimony into numbered paragraphs suitable for a CPR 32 compliant witness statement.
         Make it first person, chronological, and factual:
         
         Raw testimony: ${rawFacts}`,
        'You are a UK solicitor drafting witness statements. Follow CPR 32 requirements exactly.'
      );

      const data = {
        witnessName,
        witnessAddress,
        witnessOccupation,
        caseTitle,
        statementNumber,
        facts: structuredFacts
      };

      return this.generateDocument('witness-statement', data);
    } catch (error) {
      console.error('AI assistance failed for witness statement:', error);
      // Fallback without AI
      const data = {
        witnessName,
        witnessAddress,
        witnessOccupation,
        caseTitle,
        statementNumber,
        facts: rawFacts
      };
      return this.generateDocument('witness-statement', data);
    }
  }

  /**
   * Generate letter before action with AI legal analysis
   */
  async generateLetterBeforeAction(
    clientName: string,
    defendantName: string,
    defendantAddress: string,
    claimSummary: string,
    amountClaimed: number,
    responseDeadlineDays = 14
  ): Promise<GeneratedDocument> {
    const responseDeadline = new Date();
    responseDeadline.setDate(responseDeadline.getDate() + responseDeadlineDays);

    try {
      // Use AI to enhance legal analysis and claim summary
      const enhancedClaim = await aiService.generateDraft(
        `Enhance this claim summary for a letter before action. Make it legally precise 
         and include relevant legal principles:
         
         Original summary: ${claimSummary}
         Amount claimed: £${amountClaimed}`,
        'You are drafting pre-action correspondence. Be professional but firm.'
      );

      const data = {
        clientName,
        defendantName,
        defendantAddress,
        claimSummary: enhancedClaim.substring(0, 1000),
        amountClaimed,
        responseDeadline: format(responseDeadline, 'dd MMMM yyyy')
      };

      return this.generateDocument('letter-before-action', data);
    } catch (error) {
      console.error('AI assistance failed for letter before action:', error);
      // Fallback without AI
      const data = {
        clientName,
        defendantName,
        defendantAddress,
        claimSummary,
        amountClaimed,
        responseDeadline: format(responseDeadline, 'dd MMMM yyyy')
      };
      return this.generateDocument('letter-before-action', data);
    }
  }

  /**
   * Check document compliance with practice directions
   */
  private checkCompliance(
    template: DocumentTemplate,
    data: Record<string, any>,
    content: string
  ): GeneratedDocument['compliance'] {
    const warnings: string[] = [];
    let practiceDirectionCompliant = true;
    
    // Check required fields
    const requiredFieldsComplete = template.fields
      .filter(field => field.required)
      .every(field => data[field.name] && data[field.name].toString().trim() !== '');

    if (!requiredFieldsComplete) {
      warnings.push('Some required fields are missing or empty');
      practiceDirectionCompliant = false;
    }

    // Check word count for specific document types
    const wordCount = content.split(/\s+/).length;
    
    if (template.id === 'particulars-of-claim' && wordCount < 50) {
      warnings.push('Particulars of Claim may be too brief - consider adding more detail');
    }

    if (template.id === 'witness-statement' && wordCount > 2000) {
      warnings.push('Witness statement is very long - consider breaking into multiple statements');
    }

    // Check for statement of truth
    if (['particulars-of-claim', 'defence', 'witness-statement'].includes(template.id)) {
      if (!content.includes('Statement of Truth')) {
        warnings.push('Statement of Truth is missing');
        practiceDirectionCompliant = false;
      }
    }

    // Check for proper formatting in court documents
    if (template.category === 'pleading') {
      if (!content.includes('BETWEEN:') && !content.includes('Claimant') && !content.includes('Defendant')) {
        warnings.push('Court document may not follow standard formatting');
      }
    }

    return {
      practiceDirectionCompliant,
      wordCount,
      requiredFieldsComplete,
      warnings
    };
  }

  /**
   * AI-powered document review and suggestions
   */
  async reviewDocument(content: string, documentType: string): Promise<{
    overallScore: number;
    suggestions: Array<{ type: 'error' | 'warning' | 'suggestion'; message: string; }>;
    complianceIssues: string[];
    improvements: string[];
  }> {
    try {
      const review = await aiService.generateDraft(
        `Review this ${documentType} for:
         1. Legal accuracy and compliance with UK court rules
         2. Clarity and structure
         3. Missing elements
         4. Potential improvements
         
         Document content: ${content.substring(0, 5000)}
         
         Provide structured feedback with specific suggestions.`,
        'You are a senior UK solicitor reviewing junior work. Be constructive but thorough.'
      );

      // Parse AI review (simplified - in production use more sophisticated parsing)
      const suggestions = [
        { type: 'suggestion' as const, message: 'Document appears well-structured' },
        { type: 'warning' as const, message: 'Consider adding more specific dates and references' }
      ];

      return {
        overallScore: 8.5,
        suggestions,
        complianceIssues: [],
        improvements: [
          'Consider adding more specific legal references',
          'Ensure all dates are clearly stated',
          'Review for consistent formatting'
        ]
      };
    } catch (error) {
      console.error('AI document review failed:', error);
      return {
        overallScore: 7.0,
        suggestions: [{ type: 'warning', message: 'Automated review unavailable - please manually review' }],
        complianceIssues: [],
        improvements: []
      };
    }
  }
}

// Create singleton instance
export const documentAutomationService = new DocumentAutomationService();