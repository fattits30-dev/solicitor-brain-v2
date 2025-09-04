/* global */
// Bridge to connect TypeScript services to CommonJS server
// This provides simplified versions of the TypeScript services for immediate use

// const { Ollama } = require('ollama');

// Initialize Ollama for AI features (commented out as not currently used)
// const _ollama = new Ollama({
//   host: 'http://localhost:11434'
// });

class DeadlineCalculator {
  constructor() {
    // UK public holidays 2024-2025
    this.publicHolidays = [
      '2024-01-01',
      '2024-03-29',
      '2024-04-01',
      '2024-05-06',
      '2024-05-27',
      '2024-08-26',
      '2024-12-25',
      '2024-12-26',
      '2025-01-01',
      '2025-04-18',
      '2025-04-21',
      '2025-05-05',
      '2025-05-26',
      '2025-08-25',
      '2025-12-25',
      '2025-12-26',
    ];
  }

  calculateDeadline(eventType, startDate) {
    const start = new Date(startDate);
    let deadline = new Date(start);
    let description = '';
    let rule = '';

    // UK Civil Procedure Rules
    const cprDeadlines = {
      serviceOfClaim: { days: 14, rule: 'CPR 10.3', desc: 'Acknowledgment of Service' },
      defence: { days: 28, rule: 'CPR 15.4', desc: 'Defence' },
      defenceExtension: { days: 56, rule: 'CPR 15.5', desc: 'Defence (with extension)' },
      replyToDefence: { days: 14, rule: 'CPR 15.8', desc: 'Reply to Defence' },
      witnessStatements: { days: 28, rule: 'CPR 32.4', desc: 'Exchange witness statements' },
      expertReports: { days: 35, rule: 'CPR 35.13', desc: 'Exchange expert reports' },
      appealPermission: { days: 21, rule: 'CPR 52.4', desc: 'Permission to appeal' },
      appeal: { days: 21, rule: 'CPR 52.12', desc: 'Appeal notice' },
      setAside: { days: 14, rule: 'CPR 13.3', desc: 'Set aside default judgment' },
    };

    // Limitation periods (Limitation Act 1980)
    const limitationPeriods = {
      contract: { years: 6, desc: 'Contract claim limitation' },
      tort: { years: 6, desc: 'Tort claim limitation' },
      personalInjury: { years: 3, desc: 'Personal injury limitation' },
      defamation: { years: 1, desc: 'Defamation limitation' },
      judicialReview: { days: 90, desc: 'Judicial review limitation' },
      employmentTribunal: { days: 90, desc: 'Employment tribunal limitation' },
    };

    if (cprDeadlines[eventType]) {
      const cpr = cprDeadlines[eventType];
      deadline = this.addBusinessDays(start, cpr.days);
      description = cpr.desc;
      rule = cpr.rule;
    } else if (eventType.includes('limitation')) {
      const limitType = eventType.replace('limitation_', '');
      if (limitationPeriods[limitType]) {
        const limit = limitationPeriods[limitType];
        if (limit.years) {
          deadline.setFullYear(deadline.getFullYear() + limit.years);
        } else {
          deadline = this.addBusinessDays(start, limit.days);
        }
        description = limit.desc;
        rule = 'Limitation Act 1980';
      }
    }

    return {
      startDate: startDate,
      deadline: deadline.toISOString(),
      description: description || 'Custom deadline',
      businessDays: true,
      rule: rule || 'N/A',
      daysRemaining: Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)),
    };
  }

  addBusinessDays(date, days) {
    const result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      // Skip weekends
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        // Skip public holidays
        const dateStr = result.toISOString().split('T')[0];
        if (!this.publicHolidays.includes(dateStr)) {
          addedDays++;
        }
      }
    }

    return result;
  }
}

class DocumentGenerator {
  generateDocument(type, data) {
    const templates = {
      claimForm: this.generateClaimForm,
      particularsOfClaim: this.generateParticularsOfClaim,
      letterBeforeAction: this.generateLetterBeforeAction,
      witnessStatement: this.generateWitnessStatement,
      defenceDocument: this.generateDefence,
    };

    const generator = templates[type] || this.generateGeneric;
    return generator.call(this, data);
  }

  generateClaimForm(data) {
    return `IN THE COUNTY COURT AT ${data.court || 'CENTRAL LONDON'}
Claim No: ${data.claimNumber || '[To be allocated]'}

BETWEEN:

${data.claimant || '[CLAIMANT NAME]'}
Claimant

-and-

${data.defendant || '[DEFENDANT NAME]'}
Defendant

CLAIM FORM (N1)

Brief details of claim:
${data.briefDetails || 'The Claimant seeks damages for breach of contract'}

Value:
${data.value || 'Between £10,000 and £25,000'}

The Claimant claims:
1. ${data.claim1 || 'Damages'}
2. ${data.claim2 || 'Interest pursuant to s.69 County Courts Act 1984'}
3. ${data.claim3 || 'Costs'}

Statement of Truth
I believe that the facts stated in this claim form are true.
I understand that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a document verified by a statement of truth without an honest belief in its truth.

Signed: ________________________
${data.claimantName || '[Claimant/Litigation friend]'}
Date: ${new Date().toLocaleDateString('en-GB')}`;
  }

  generateParticularsOfClaim(data) {
    return `IN THE COUNTY COURT AT ${data.court || 'CENTRAL LONDON'}
Claim No: ${data.claimNumber || '[Number]'}

BETWEEN:
${data.claimant || '[CLAIMANT]'}
Claimant
-and-
${data.defendant || '[DEFENDANT]'}
Defendant

PARTICULARS OF CLAIM

1. ${data.para1 || 'The Claimant is [description]. The Defendant is [description].'}

2. ${data.para2 || 'By a contract made [date] the Defendant agreed to [details].'}

3. ${data.para3 || 'It was an express/implied term of the contract that [terms].'}

4. ${data.para4 || 'In breach of contract the Defendant has [breaches].'}

5. ${data.para5 || 'By reason of the matters aforesaid, the Claimant has suffered loss and damage.'}

PARTICULARS OF LOSS
${data.losses || '(a) [Loss item 1]: £[amount]\n(b) [Loss item 2]: £[amount]'}

6. Further, the Claimant claims interest pursuant to s.69 of the County Courts Act 1984 at 8% per annum.

AND THE CLAIMANT CLAIMS:
(1) Damages
(2) Interest
(3) Costs

Statement of Truth
[As per CPR 22.1]

Dated: ${new Date().toLocaleDateString('en-GB')}`;
  }

  generateLetterBeforeAction(data) {
    return `${data.senderAddress || '[Your Address]'}

${new Date().toLocaleDateString('en-GB')}

${data.recipientName || '[Recipient Name]'}
${data.recipientAddress || '[Recipient Address]'}

Dear ${data.recipientName || 'Sir/Madam'},

LETTER BEFORE ACTION
${data.preActionProtocol || 'Pre-Action Protocol for Debt Claims'}

Our Client: ${data.clientName || '[Client Name]'}
Your Reference: ${data.reference || '[If applicable]'}

We act for the above-named client in connection with ${data.matter || 'the following matter'}.

THE CLAIM
${data.claimDetails || "Our client's claim is for [amount] arising from [brief description of claim]."}

THE FACTS
${data.facts || '1. [Key fact 1]\n2. [Key fact 2]\n3. [Key fact 3]'}

SETTLEMENT
${data.settlement || 'Our client is willing to accept £[amount] in full and final settlement if paid within 14 days.'}

RESPONSE REQUIRED
Please acknowledge this letter within 7 days and provide a full response within 14 days.

If we do not receive a satisfactory response within this timeframe, our client will commence proceedings without further notice. This may result in you incurring costs and a County Court Judgment being entered against you.

ADR
Our client is willing to consider alternative dispute resolution. Please indicate if you wish to explore this option.

Yours faithfully,

${data.senderName || '[Solicitor Name]'}
${data.firm || '[Law Firm]'}`;
  }

  generateWitnessStatement(data) {
    return `IN THE COUNTY COURT AT ${data.court || '[COURT]'}
Claim No: ${data.claimNumber || '[Number]'}

BETWEEN:
${data.claimant || '[CLAIMANT]'}
Claimant
-and-
${data.defendant || '[DEFENDANT]'}
Defendant

WITNESS STATEMENT OF ${data.witnessName || '[WITNESS NAME]'}

I, ${data.witnessName || '[FULL NAME]'}, of ${data.witnessAddress || '[ADDRESS]'}, ${data.occupation || '[OCCUPATION]'}, WILL SAY as follows:

1. I make this witness statement in support of the ${data.party || 'Claimant'}'s case. The facts stated are within my own knowledge unless otherwise stated, in which case I identify the source of my information or belief.

2. ${data.para1 || '[First paragraph of evidence]'}

3. ${data.para2 || '[Second paragraph of evidence]'}

4. ${data.para3 || '[Third paragraph of evidence]'}

5. ${data.para4 || '[Fourth paragraph of evidence]'}

Statement of Truth
I believe that the facts stated in this witness statement are true. I understand that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a document verified by a statement of truth without an honest belief in its truth.

Signed: ________________________
${data.witnessName || '[Witness Name]'}
Date: ${new Date().toLocaleDateString('en-GB')}`;
  }

  generateDefence(data) {
    return `IN THE COUNTY COURT AT ${data.court || '[COURT]'}
Claim No: ${data.claimNumber || '[Number]'}

BETWEEN:
${data.claimant || '[CLAIMANT]'}
Claimant
-and-
${data.defendant || '[DEFENDANT]'}
Defendant

DEFENCE

1. Save as expressly admitted, each allegation in the Particulars of Claim is denied.

2. ${data.para1 || 'Paragraph 1 of the Particulars of Claim is admitted.'}

3. ${data.para2 || 'As to paragraph 2, it is denied that [specific denial with reasons].'}

4. ${data.para3 || 'As to paragraph 3, the Defendant will say that [positive case].'}

5. ${data.para4 || 'It is denied that the Claimant has suffered the alleged or any loss and damage.'}

6. ${data.para5 || "Further or alternatively, any loss was caused by the Claimant's own actions."}

7. For the reasons set out above, the Defendant denies liability to the Claimant.

Statement of Truth
[As per CPR 22.1]

Dated: ${new Date().toLocaleDateString('en-GB')}`;
  }

  generateGeneric() {
    return 'Template not found. Please specify a valid document type.';
  }
}

class ComplianceChecker {
  async checkCompliance(type, data) {
    const issues = [];
    const recommendations = [];
    const actions = [];

    switch (type) {
      case 'sra':
        this.checkSRACompliance(data, issues, recommendations, actions);
        break;
      case 'gdpr':
        this.checkGDPRCompliance(data, issues, recommendations, actions);
        break;
      case 'aml':
        this.checkAMLCompliance(data, issues, recommendations, actions);
        break;
      case 'clientMoney':
        this.checkClientMoneyCompliance(data, issues, recommendations, actions);
        break;
      default:
        issues.push('Unknown compliance check type');
    }

    return {
      type,
      compliant: issues.length === 0,
      issues,
      recommendations,
      actions,
      checkedAt: new Date().toISOString(),
      nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  checkSRACompliance(data, issues, recommendations, actions) {
    // SRA Principles
    if (!data.actWithIntegrity) {
      issues.push('SRA Principle 1: Must act with integrity');
      recommendations.push('Review all current matters for integrity concerns');
    }

    if (!data.maintainTrust) {
      issues.push('SRA Principle 2: Must maintain public trust');
      recommendations.push('Implement transparency measures');
    }

    if (!data.independenceProtected) {
      issues.push('SRA Principle 3: Independence compromised');
      actions.push('Review all third-party relationships');
    }

    if (!data.clientInterests) {
      issues.push("SRA Principle 4: Must act in clients' best interests");
      actions.push('Audit all active matters for client benefit');
    }

    if (!data.competentService) {
      issues.push('SRA Principle 5: Service not meeting competence standards');
      recommendations.push('Implement quality assurance procedures');
    }
  }

  checkGDPRCompliance(data, issues, recommendations, actions) {
    // GDPR Articles
    if (!data.lawfulBasis) {
      issues.push('GDPR Article 6: No lawful basis for processing');
      actions.push('Document lawful basis for all data processing');
    }

    if (!data.privacyNotice) {
      issues.push('GDPR Article 13: Privacy notice not provided');
      actions.push('Issue privacy notices to all data subjects');
    }

    if (!data.dataMinimisation) {
      issues.push('GDPR Article 5(1)(c): Data minimisation principle violated');
      recommendations.push('Review and delete unnecessary data');
    }

    if (!data.securityMeasures) {
      issues.push('GDPR Article 32: Insufficient security measures');
      actions.push('Implement encryption and access controls');
    }

    if (!data.retentionPolicy) {
      issues.push('GDPR Article 5(1)(e): No retention policy');
      recommendations.push('Create and implement data retention policy');
    }
  }

  checkAMLCompliance(data, issues, recommendations, actions) {
    // Money Laundering Regulations 2017
    if (!data.customerDueDiligence) {
      issues.push('MLR 2017 Reg 27: Customer due diligence not completed');
      actions.push('Complete CDD for all clients immediately');
    }

    if (!data.ongoingMonitoring) {
      issues.push('MLR 2017 Reg 28: No ongoing monitoring');
      recommendations.push('Implement transaction monitoring system');
    }

    if (!data.riskAssessment) {
      issues.push('MLR 2017 Reg 18: Risk assessment required');
      actions.push('Conduct firm-wide risk assessment');
    }

    if (!data.recordKeeping) {
      issues.push('MLR 2017 Reg 40: Inadequate record keeping');
      recommendations.push('Maintain records for 5 years');
    }
  }

  checkClientMoneyCompliance(data, issues, recommendations, actions) {
    // SRA Accounts Rules
    if (!data.separateAccount) {
      issues.push('SRA Rule 4.1: Client money not in separate account');
      actions.push('Open client account immediately');
    }

    if (!data.accountingRecords) {
      issues.push('SRA Rule 8.1: Accounting records incomplete');
      actions.push('Implement proper accounting system');
    }

    if (!data.reconciliation) {
      issues.push('SRA Rule 8.3: No reconciliation performed');
      recommendations.push('Perform monthly reconciliations');
    }

    if (!data.accountantsReport && data.clientMoneyHeld) {
      issues.push("SRA Rule 12: Accountant's report required");
      actions.push("Arrange accountant's report within 6 months");
    }
  }
}

// Export for use in CommonJS
module.exports = {
  DeadlineCalculator,
  DocumentGenerator,
  ComplianceChecker,
};
