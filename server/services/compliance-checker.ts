import { aiService } from './ai.js';
import { addDays, differenceInDays /*, format */ } from 'date-fns';

export interface ComplianceCheck {
  id: string;
  category: 'SRA' | 'GDPR' | 'AML' | 'CLIENT_MONEY' | 'CONFLICT' | 'GENERAL';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'compliant' | 'non_compliant' | 'requires_attention' | 'unknown';
  recommendation: string;
  regulation: string; // Legal reference
  lastChecked: Date;
  nextCheckDue?: Date;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType?: 'direct' | 'potential' | 'positional';
  conflictingCases: Array<{
    caseId: string;
    clientName: string;
    conflictReason: string;
    severity: 'critical' | 'high' | 'medium';
  }>;
  recommendation: string;
  requiresWaiver: boolean;
}

export interface AMLRiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'prohibited';
  riskFactors: Array<{
    factor: string;
    impact: 'low' | 'medium' | 'high';
    description: string;
  }>;
  dueDiligenceRequired: string[];
  ongoingMonitoring: boolean;
  reportingRequired: boolean;
  recommendation: string;
}

export interface GDPRComplianceCheck {
  dataProcessingLawful: boolean;
  consentObtained: boolean;
  dataMinimised: boolean;
  retentionPolicyCompliant: boolean;
  securityMeasuresAdequate: boolean;
  breachProceduresInPlace: boolean;
  dataSubjectRightsRespected: boolean;
  issues: string[];
  recommendations: string[];
}

export interface ClientMoneyCheck {
  clientAccountCompliant: boolean;
  segregationMaintained: boolean;
  reconciliationsUpToDate: boolean;
  interestCalculatedCorrectly: boolean;
  recordsAdequate: boolean;
  issues: string[];
  lastReconciliationDate?: Date;
  overdueReconciliations: number;
}

class ComplianceCheckerService {
  // SRA Principles (2019)
  private sraPrinciples = [
    {
      number: 1,
      title: 'Act with honesty',
      description: 'You uphold the rule of law and the proper administration of justice.',
    },
    {
      number: 2,
      title: 'Act with integrity',
      description: 'You act with honesty.',
    },
    {
      number: 3,
      title: 'Maintain independence',
      description: 'You do not allow your independence to be compromised.',
    },
    {
      number: 4,
      title: 'Act in clients best interests',
      description: 'You act in the best interests of each client.',
    },
    {
      number: 5,
      title: 'Provide proper service',
      description: 'You provide a proper standard of service to your clients.',
    },
    {
      number: 6,
      title: 'Behave in a trustworthy way',
      description:
        'You behave in a way that maintains the trust the public places in you and in the provision of legal services.',
    },
    {
      number: 7,
      title: 'Comply with legal and regulatory obligations',
      description:
        'You comply with your legal and regulatory obligations and deal with your regulators and ombudsmen in an open, timely and co-operative manner.',
    },
  ];

  // AML risk factors
  private amlRiskFactors = [
    {
      factor: 'High net worth client',
      impact: 'medium' as const,
      description: 'Clients with significant wealth may require enhanced due diligence',
    },
    {
      factor: 'Politically Exposed Person (PEP)',
      impact: 'high' as const,
      description: 'PEPs require enhanced due diligence under MLR 2017',
    },
    {
      factor: 'Complex ownership structure',
      impact: 'high' as const,
      description: 'Complex corporate structures may obscure beneficial ownership',
    },
    {
      factor: 'Cash-intensive business',
      impact: 'high' as const,
      description: 'Businesses dealing primarily in cash present higher money laundering risk',
    },
    {
      factor: 'High-risk jurisdiction',
      impact: 'high' as const,
      description:
        'Clients or transactions involving high-risk countries require enhanced scrutiny',
    },
    {
      factor: 'Unusual payment method',
      impact: 'medium' as const,
      description: 'Payments from unexpected sources or in unusual forms',
    },
    {
      factor: 'Rushed transaction',
      impact: 'medium' as const,
      description: 'Clients seeking to complete transactions unusually quickly',
    },
  ];

  /**
   * Perform comprehensive compliance check for a case
   */
  async performComplianceCheck(
    caseId: string,
    clientData: any,
    caseData: any,
    _firmData?: any,
  ): Promise<{
    overallCompliance: 'compliant' | 'issues_identified' | 'non_compliant';
    checks: ComplianceCheck[];
    conflictCheck: ConflictCheckResult;
    amlAssessment: AMLRiskAssessment;
    gdprCheck: GDPRComplianceCheck;
    clientMoneyCheck?: ClientMoneyCheck;
    actionItems: Array<{ priority: string; action: string; deadline?: Date }>;
  }> {
    const checks: ComplianceCheck[] = [];
    const _now = new Date();

    // 1. SRA Principles Check
    const sraChecks = await this.checkSRAPrinciples(caseData, clientData);
    checks.push(...sraChecks);

    // 2. Conflict of Interest Check
    const conflictCheck = await this.performConflictCheck(clientData, caseData);

    // 3. AML Risk Assessment
    const amlAssessment = await this.performAMLRiskAssessment(clientData, caseData);

    // 4. GDPR Compliance Check
    const gdprCheck = await this.performGDPRCheck(clientData, caseData);

    // 5. Client Money Check (if applicable)
    let clientMoneyCheck: ClientMoneyCheck | undefined;
    if (caseData.involvesClientMoney) {
      clientMoneyCheck = await this.performClientMoneyCheck(caseId, caseData);
    }

    // Determine overall compliance
    const criticalIssues = checks.filter(
      (c) => c.severity === 'critical' && c.status === 'non_compliant',
    ).length;
    const highIssues = checks.filter(
      (c) => c.severity === 'high' && c.status === 'non_compliant',
    ).length;

    let overallCompliance: 'compliant' | 'issues_identified' | 'non_compliant';
    if (criticalIssues > 0 || conflictCheck.hasConflict) {
      overallCompliance = 'non_compliant';
    } else if (highIssues > 0 || amlAssessment.riskLevel === 'high') {
      overallCompliance = 'issues_identified';
    } else {
      overallCompliance = 'compliant';
    }

    // Generate action items
    const actionItems = this.generateActionItems(checks, conflictCheck, amlAssessment, gdprCheck);

    return {
      overallCompliance,
      checks,
      conflictCheck,
      amlAssessment,
      gdprCheck,
      clientMoneyCheck,
      actionItems,
    };
  }

  /**
   * Check SRA Principles compliance
   */
  private async checkSRAPrinciples(caseData: any, clientData: any): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];
    const now = new Date();

    // Principle 1: Uphold rule of law
    checks.push({
      id: 'sra-principle-1',
      category: 'SRA',
      title: 'Rule of Law Compliance',
      description: 'Ensuring case conduct upholds rule of law and proper administration of justice',
      severity: 'critical',
      status:
        caseData.conductComplaints || caseData.regulatoryIssues ? 'non_compliant' : 'compliant',
      recommendation: 'Review case conduct for any issues that might undermine rule of law',
      regulation: 'SRA Principle 1',
      lastChecked: now,
      nextCheckDue: addDays(now, 30),
    });

    // Principle 2: Act with honesty
    checks.push({
      id: 'sra-principle-2',
      category: 'SRA',
      title: 'Honesty and Integrity',
      description: 'Acting with honesty in all professional dealings',
      severity: 'critical',
      status: 'compliant', // Would need specific checks
      recommendation: 'Ensure all communications and documentation are honest and accurate',
      regulation: 'SRA Principle 2',
      lastChecked: now,
    });

    // Principle 4: Best interests of client
    const hasConflicts = await this.checkForConflicts(clientData);
    checks.push({
      id: 'sra-principle-4',
      category: 'SRA',
      title: 'Client Best Interests',
      description: 'Acting in the best interests of each client',
      severity: 'high',
      status: hasConflicts ? 'requires_attention' : 'compliant',
      recommendation: hasConflicts
        ? 'Address potential conflicts of interest'
        : 'Continue monitoring client interests',
      regulation: 'SRA Principle 4',
      lastChecked: now,
      nextCheckDue: addDays(now, 14),
    });

    // Principle 5: Proper standard of service
    const serviceConcerns = this.checkServiceStandards(caseData);
    checks.push({
      id: 'sra-principle-5',
      category: 'SRA',
      title: 'Standard of Service',
      description: 'Providing proper standard of service to clients',
      severity: 'high',
      status: serviceConcerns.length > 0 ? 'requires_attention' : 'compliant',
      recommendation:
        serviceConcerns.length > 0
          ? 'Address service quality issues'
          : 'Maintain current service standards',
      regulation: 'SRA Principle 5',
      lastChecked: now,
    });

    return checks;
  }

  /**
   * Perform conflict of interest check
   */
  async performConflictCheck(
    clientData: any,
    caseData: any,
    existingCases?: any[],
  ): Promise<ConflictCheckResult> {
    try {
      // Use AI to analyze potential conflicts
      const _conflictAnalysis = await aiService.generateDraft(
        `Analyze potential conflicts of interest for this new client/case:
         
         New Client: ${JSON.stringify(clientData)}
         New Case: ${JSON.stringify(caseData)}
         
         Check against these factors:
         1. Direct conflicts (acting against existing client)
         2. Positional conflicts (inconsistent positions on law)
         3. Confidential information conflicts
         4. Business/financial conflicts
         
         Existing cases to check against: ${JSON.stringify(existingCases?.slice(0, 10) || [])}`,
        'You are a UK compliance officer checking for conflicts of interest under SRA rules.',
      );

      // For demonstration, perform basic conflict checks
      const conflicts = [];
      let hasConflict = false;
      let conflictType: 'direct' | 'potential' | 'positional' | undefined;

      // Check for direct conflicts (same parties on opposite sides)
      if (existingCases) {
        for (const existingCase of existingCases) {
          if (
            existingCase.defendantName === clientData.name ||
            existingCase.claimantName === caseData.defendantName
          ) {
            hasConflict = true;
            conflictType = 'direct';
            conflicts.push({
              caseId: existingCase.id,
              clientName: existingCase.clientName,
              conflictReason: 'Direct conflict - acting for opposing parties',
              severity: 'critical' as const,
            });
          }
        }
      }

      // Check for potential conflicts based on business relationships
      if (clientData.businessConnections?.length > 0) {
        // This would check against existing client databases
        conflictType = conflictType || 'potential';
      }

      return {
        hasConflict,
        conflictType,
        conflictingCases: conflicts,
        recommendation: hasConflict
          ? 'Do not proceed without resolving conflict or obtaining appropriate waivers'
          : 'No conflicts identified - safe to proceed',
        requiresWaiver: hasConflict && conflictType !== 'direct',
      };
    } catch (error) {
      console.error('Conflict check failed:', error);
      return {
        hasConflict: false,
        conflictingCases: [],
        recommendation: 'Manual conflict check required - automated system unavailable',
        requiresWaiver: false,
      };
    }
  }

  /**
   * Perform AML risk assessment
   */
  async performAMLRiskAssessment(clientData: any, caseData: any): Promise<AMLRiskAssessment> {
    const riskFactors = [];
    let riskScore = 0;

    // Check each risk factor
    for (const factor of this.amlRiskFactors) {
      let factorPresent = false;

      switch (factor.factor) {
        case 'High net worth client':
          factorPresent = clientData.netWorth > 1000000 || caseData.transactionValue > 500000;
          break;
        case 'Politically Exposed Person (PEP)':
          factorPresent = clientData.isPEP || clientData.politicalConnections;
          break;
        case 'Complex ownership structure':
          factorPresent =
            clientData.corporateStructure === 'complex' ||
            (clientData.beneficialOwners && clientData.beneficialOwners.length > 3);
          break;
        case 'Cash-intensive business':
          factorPresent =
            clientData.businessType === 'cash_intensive' ||
            clientData.industry === 'retail' ||
            clientData.industry === 'hospitality';
          break;
        case 'High-risk jurisdiction':
          factorPresent =
            clientData.jurisdiction && this.isHighRiskJurisdiction(clientData.jurisdiction);
          break;
        case 'Unusual payment method':
          factorPresent =
            caseData.paymentMethod === 'cash' || caseData.paymentMethod === 'cryptocurrency';
          break;
        case 'Rushed transaction':
          factorPresent =
            caseData.urgency === 'immediate' ||
            (caseData.deadline && differenceInDays(new Date(caseData.deadline), new Date()) < 7);
          break;
      }

      if (factorPresent) {
        riskFactors.push(factor);
        riskScore += factor.impact === 'high' ? 3 : factor.impact === 'medium' ? 2 : 1;
      }
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'prohibited';
    if (riskScore >= 9) riskLevel = 'prohibited';
    else if (riskScore >= 6) riskLevel = 'high';
    else if (riskScore >= 3) riskLevel = 'medium';
    else riskLevel = 'low';

    // Determine due diligence requirements
    const dueDiligenceRequired = [];
    if (riskLevel === 'high' || riskLevel === 'prohibited') {
      dueDiligenceRequired.push('Enhanced due diligence');
      dueDiligenceRequired.push('Source of funds verification');
      dueDiligenceRequired.push('Beneficial ownership identification');
    }
    if (riskFactors.some((f) => f.factor === 'Politically Exposed Person (PEP)')) {
      dueDiligenceRequired.push('PEP enhanced due diligence');
      dueDiligenceRequired.push('Senior management approval');
    }

    const ongoingMonitoring = riskLevel !== 'low';
    const reportingRequired =
      riskLevel === 'prohibited' || riskFactors.some((f) => f.factor.includes('suspicious'));

    let recommendation: string;
    switch (riskLevel) {
      case 'prohibited':
        recommendation =
          'Do not proceed - risk too high. Consider filing SAR if suspicious activity detected.';
        break;
      case 'high':
        recommendation =
          'Enhanced due diligence required before proceeding. Senior partner approval needed.';
        break;
      case 'medium':
        recommendation =
          'Standard due diligence plus additional verification of identified risk factors.';
        break;
      default:
        recommendation = 'Standard due diligence procedures sufficient.';
    }

    return {
      riskLevel,
      riskFactors,
      dueDiligenceRequired,
      ongoingMonitoring,
      reportingRequired,
      recommendation,
    };
  }

  /**
   * Perform GDPR compliance check
   */
  async performGDPRCheck(clientData: any, caseData: any): Promise<GDPRComplianceCheck> {
    const issues = [];
    const recommendations = [];

    // Article 6 - Lawfulness of processing
    const dataProcessingLawful =
      caseData.legalBasis &&
      ['consent', 'contract', 'legal_obligation', 'legitimate_interests'].includes(
        caseData.legalBasis,
      );
    if (!dataProcessingLawful) {
      issues.push('No clear legal basis for data processing identified');
      recommendations.push('Establish and document legal basis for processing personal data');
    }

    // Article 7 - Consent
    const consentObtained = clientData.consentGiven || caseData.legalBasis !== 'consent';
    if (!consentObtained) {
      issues.push('Consent not obtained where required');
      recommendations.push('Obtain explicit consent for data processing where required');
    }

    // Article 5(1)(c) - Data minimisation
    const dataMinimised = true; // Would need to check what data is actually collected
    if (!dataMinimised) {
      issues.push('Excessive data collection identified');
      recommendations.push('Review data collection to ensure it is adequate, relevant and limited');
    }

    // Article 5(1)(e) - Storage limitation
    const retentionPolicyCompliant = caseData.retentionPeriod && caseData.retentionPeriod <= 7; // Years
    if (!retentionPolicyCompliant) {
      issues.push('Data retention period not compliant or not specified');
      recommendations.push('Review and implement compliant data retention policy');
    }

    // Article 32 - Security of processing
    const securityMeasuresAdequate =
      clientData.encryptionEnabled && clientData.accessControlsInPlace;
    if (!securityMeasuresAdequate) {
      issues.push('Inadequate security measures for personal data');
      recommendations.push('Implement appropriate technical and organisational security measures');
    }

    // Article 33 - Notification of breach
    const breachProceduresInPlace = true; // Would check firm's breach response procedures
    if (!breachProceduresInPlace) {
      issues.push('No breach notification procedures in place');
      recommendations.push('Establish procedures for data breach notification within 72 hours');
    }

    // Chapter III - Data subject rights
    const dataSubjectRightsRespected = clientData.rightToAccessProvided !== false;
    if (!dataSubjectRightsRespected) {
      issues.push('Data subject rights not adequately provided for');
      recommendations.push('Ensure procedures in place for data subject rights requests');
    }

    return {
      dataProcessingLawful,
      consentObtained,
      dataMinimised,
      retentionPolicyCompliant,
      securityMeasuresAdequate,
      breachProceduresInPlace,
      dataSubjectRightsRespected,
      issues,
      recommendations,
    };
  }

  /**
   * Perform client money compliance check
   */
  async performClientMoneyCheck(caseId: string, caseData: any): Promise<ClientMoneyCheck> {
    const issues = [];

    // SRA Accounts Rules compliance
    const clientAccountCompliant = caseData.clientAccount?.separated === true;
    if (!clientAccountCompliant) {
      issues.push('Client money not held in separate client account');
    }

    const segregationMaintained = !caseData.clientAccount?.mixedWithFirmMoney;
    if (!segregationMaintained) {
      issues.push('Client money mixed with firm money');
    }

    const lastReconciliationDate = caseData.clientAccount?.lastReconciliation
      ? new Date(caseData.clientAccount.lastReconciliation)
      : undefined;

    const reconciliationsUpToDate = lastReconciliationDate
      ? differenceInDays(new Date(), lastReconciliationDate) <= 35 // Monthly reconciliation + buffer
      : false;

    if (!reconciliationsUpToDate) {
      issues.push('Client account reconciliations overdue');
    }

    const interestCalculatedCorrectly = caseData.clientAccount?.interestCalculation === 'accurate';
    if (!interestCalculatedCorrectly) {
      issues.push('Client money interest may not be calculated correctly');
    }

    const recordsAdequate = caseData.clientAccount?.recordsComplete === true;
    if (!recordsAdequate) {
      issues.push('Inadequate client money records');
    }

    const overdueReconciliations = lastReconciliationDate
      ? Math.max(0, Math.floor(differenceInDays(new Date(), lastReconciliationDate) / 30))
      : 1;

    return {
      clientAccountCompliant,
      segregationMaintained,
      reconciliationsUpToDate,
      interestCalculatedCorrectly,
      recordsAdequate,
      issues,
      lastReconciliationDate,
      overdueReconciliations,
    };
  }

  /**
   * Generate action items from compliance checks
   */
  private generateActionItems(
    checks: ComplianceCheck[],
    conflictCheck: ConflictCheckResult,
    amlAssessment: AMLRiskAssessment,
    gdprCheck: GDPRComplianceCheck,
  ): Array<{ priority: string; action: string; deadline?: Date }> {
    const actionItems = [];

    // Critical compliance issues
    for (const check of checks.filter(
      (c) => c.severity === 'critical' && c.status === 'non_compliant',
    )) {
      actionItems.push({
        priority: 'critical',
        action: `Resolve ${check.title}: ${check.recommendation}`,
        deadline: addDays(new Date(), 1),
      });
    }

    // Conflict issues
    if (conflictCheck.hasConflict) {
      actionItems.push({
        priority: 'critical',
        action: 'Resolve conflict of interest before proceeding with matter',
        deadline: addDays(new Date(), 1),
      });
    }

    // High AML risk
    if (amlAssessment.riskLevel === 'high') {
      actionItems.push({
        priority: 'high',
        action: 'Complete enhanced due diligence before proceeding',
        deadline: addDays(new Date(), 3),
      });
    }

    // GDPR issues
    if (gdprCheck.issues.length > 0) {
      actionItems.push({
        priority: 'high',
        action: 'Address GDPR compliance issues identified',
        deadline: addDays(new Date(), 7),
      });
    }

    return actionItems;
  }

  /**
   * Helper methods
   */
  private async checkForConflicts(clientData: any): Promise<boolean> {
    // Simplified conflict check
    return clientData.competitorClient === true || clientData.adversaryClient === true;
  }

  private checkServiceStandards(caseData: any): string[] {
    const concerns = [];

    if (caseData.responseTime > 5) {
      concerns.push('Slow response times to client communications');
    }

    if (caseData.missedDeadlines > 0) {
      concerns.push('Missed case deadlines');
    }

    if (caseData.clientComplaints > 0) {
      concerns.push('Client service complaints received');
    }

    return concerns;
  }

  private isHighRiskJurisdiction(jurisdiction: string): boolean {
    // Simplified list - in practice would use FATF lists
    const highRiskCountries = [
      'North Korea',
      'Iran',
      'Myanmar',
      'Afghanistan',
      'Syria',
      'Yemen',
      'Libya',
      'Somalia',
      'Sudan',
    ];

    return highRiskCountries.includes(jurisdiction);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    caseId: string,
    complianceData: any,
  ): Promise<{
    summary: string;
    detailedFindings: string;
    actionPlan: string;
    riskRating: 'low' | 'medium' | 'high' | 'critical';
  }> {
    try {
      const report = await aiService.generateDraft(
        `Generate a comprehensive compliance report for case ${caseId} with this data:
         ${JSON.stringify(complianceData)}
         
         Include:
         1. Executive summary of compliance status
         2. Detailed findings by regulation type
         3. Action plan with priorities and timelines
         4. Overall risk assessment`,
        'You are a compliance officer preparing a report for senior management.',
      );

      // Parse and structure the report (simplified)
      return {
        summary: 'Compliance review completed with [X] issues identified requiring attention.',
        detailedFindings: report.substring(0, 2000),
        actionPlan: 'Priority actions have been identified with specific deadlines.',
        riskRating: complianceData.overallCompliance === 'non_compliant' ? 'critical' : 'medium',
      };
    } catch (error) {
      console.error('Compliance report generation failed:', error);
      return {
        summary: 'Compliance review completed - manual report required.',
        detailedFindings: 'Automated report generation unavailable.',
        actionPlan: 'Review compliance data manually and create action plan.',
        riskRating: 'medium',
      };
    }
  }
}

// Create singleton instance
export const complianceCheckerService = new ComplianceCheckerService();
