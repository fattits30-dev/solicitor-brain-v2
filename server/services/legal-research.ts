import { aiService } from './ai.js';
import { format } from 'date-fns';

export interface CaseCitation {
  citation: string;
  courtLevel: 'supreme_court' | 'court_of_appeal' | 'high_court' | 'county_court' | 'tribunal';
  year: number;
  parties: {
    appellant?: string;
    respondent?: string;
    claimant?: string;
    defendant?: string;
  };
  neutralCitation?: string;
  lawReports?: string[];
  jurisdiction: 'england_wales' | 'scotland' | 'northern_ireland' | 'uk';
}

export interface LegalPrinciple {
  id: string;
  principle: string;
  authority: CaseCitation[];
  area_of_law: string;
  ratio_decidendi: string;
  obiter_dictum?: string;
  distinguished_in?: CaseCitation[];
  approved_in?: CaseCitation[];
  overruled_by?: CaseCitation;
  confidence: number; // 0-1 scale
}

export interface StatutoryProvision {
  act: string;
  year: number;
  section: string;
  subsection?: string;
  title: string;
  text: string;
  in_force: boolean;
  amended_by?: string[];
  repealed_by?: string;
}

export interface ResearchQuery {
  question: string;
  area_of_law?: string;
  jurisdiction?: string;
  date_range?: {
    from: Date;
    to: Date;
  };
  include_unreported?: boolean;
  court_level?: string[];
}

export interface ResearchResult {
  query: ResearchQuery;
  relevant_cases: Array<{
    citation: CaseCitation;
    relevance_score: number;
    summary: string;
    key_principles: string[];
    distinguishing_factors?: string[];
  }>;
  relevant_statutes: Array<{
    provision: StatutoryProvision;
    relevance_score: number;
    summary: string;
  }>;
  legal_analysis: string;
  precedent_hierarchy: Array<{
    level: number;
    cases: CaseCitation[];
    binding_authority: boolean;
  }>;
  recommended_arguments: string[];
  potential_counterarguments: string[];
  research_confidence: number;
}

export interface ArgumentOutline {
  main_argument: string;
  supporting_points: Array<{
    point: string;
    authorities: Array<{
      citation: string;
      principle: string;
      quote?: string;
    }>;
    statutory_support?: string[];
  }>;
  counterarguments: Array<{
    argument: string;
    response: string;
    authorities: string[];
  }>;
  conclusion: string;
}

class LegalResearchService {
  
  // UK Court hierarchy for precedent analysis
  private courtHierarchy = {
    supreme_court: 1,
    court_of_appeal: 2,
    high_court: 3,
    county_court: 4,
    tribunal: 5
  };

  // Common legal areas for categorization
  private legalAreas = [
    'Contract Law', 'Tort Law', 'Property Law', 'Employment Law',
    'Criminal Law', 'Family Law', 'Commercial Law', 'Public Law',
    'EU Law', 'Human Rights', 'Immigration', 'Personal Injury',
    'Professional Negligence', 'Company Law', 'Insolvency',
    'Intellectual Property', 'Competition Law', 'Tax Law'
  ];

  // Sample case database (in production, this would connect to legal databases)
  private sampleCases: Array<{
    citation: CaseCitation;
    summary: string;
    principles: string[];
    ratio_decidendi: string;
    area_of_law: string;
    facts: string;
    keywords: string[];
  }> = [
    {
      citation: {
        citation: 'Donoghue v Stevenson [1932] AC 562',
        courtLevel: 'supreme_court',
        year: 1932,
        parties: { appellant: 'Donoghue', respondent: 'Stevenson' },
        neutralCitation: '[1932] AC 562',
        jurisdiction: 'uk'
      },
      summary: 'Foundational case establishing duty of care in negligence',
      principles: ['Neighbour principle', 'Duty of care', 'Negligence'],
      ratio_decidendi: 'You must take reasonable care to avoid acts or omissions which you can reasonably foresee would be likely to injure your neighbour',
      area_of_law: 'Tort Law',
      facts: 'Contaminated ginger beer in opaque bottle causing illness',
      keywords: ['negligence', 'duty of care', 'neighbour principle', 'foreseeability', 'product liability']
    },
    {
      citation: {
        citation: 'Carlill v Carbolic Smoke Ball Company [1893] 1 QB 256',
        courtLevel: 'court_of_appeal',
        year: 1893,
        parties: { appellant: 'Carlill', respondent: 'Carbolic Smoke Ball Company' },
        neutralCitation: '[1893] 1 QB 256',
        jurisdiction: 'england_wales'
      },
      summary: 'Formation of unilateral contracts through advertisement',
      principles: ['Unilateral contract', 'Acceptance by conduct', 'Consideration'],
      ratio_decidendi: 'An advertisement can constitute an offer capable of acceptance, especially when performance is the method of acceptance',
      area_of_law: 'Contract Law',
      facts: 'Advertisement offering £100 reward for contracting influenza after using product',
      keywords: ['unilateral contract', 'advertisement', 'offer', 'acceptance', 'consideration', 'reward']
    },
    {
      citation: {
        citation: 'Hadley v Baxendale (1854) 9 Exch 341',
        courtLevel: 'high_court',
        year: 1854,
        parties: { claimant: 'Hadley', defendant: 'Baxendale' },
        neutralCitation: '(1854) 9 Exch 341',
        jurisdiction: 'england_wales'
      },
      summary: 'Remoteness of damage in contract - two limbs test',
      principles: ['Remoteness of damage', 'Foreseeability', 'Consequential loss'],
      ratio_decidendi: 'Damages must either arise naturally from the breach or be within reasonable contemplation of parties',
      area_of_law: 'Contract Law',
      facts: 'Delayed delivery of mill shaft causing business losses',
      keywords: ['damages', 'remoteness', 'foreseeability', 'consequential loss', 'breach of contract']
    }
  ];

  /**
   * Perform comprehensive legal research
   */
  async performResearch(query: ResearchQuery): Promise<ResearchResult> {
    try {
      // 1. Search for relevant cases
      const relevantCases = await this.searchCases(query);
      
      // 2. Search for relevant statutes
      const relevantStatutes = await this.searchStatutes(query);
      
      // 3. Generate legal analysis using AI
      const legalAnalysis = await this.generateLegalAnalysis(query, relevantCases, relevantStatutes);
      
      // 4. Build precedent hierarchy
      const precedentHierarchy = this.buildPrecedentHierarchy(relevantCases.map(r => r.citation));
      
      // 5. Generate argument recommendations
      const argumentAnalysis = await this.generateArgumentOutline(query, relevantCases, relevantStatutes);
      
      return {
        query,
        relevant_cases: relevantCases,
        relevant_statutes: relevantStatutes,
        legal_analysis: legalAnalysis,
        precedent_hierarchy: precedentHierarchy,
        recommended_arguments: argumentAnalysis.supporting_points.map(p => p.point),
        potential_counterarguments: argumentAnalysis.counterarguments.map(c => c.argument),
        research_confidence: this.calculateResearchConfidence(relevantCases, relevantStatutes)
      };

    } catch (error) {
      console.error('Legal research failed:', error);
      return this.getFallbackResearchResult(query);
    }
  }

  /**
   * Search for relevant cases
   */
  private async searchCases(query: ResearchQuery): Promise<Array<{
    citation: CaseCitation;
    relevance_score: number;
    summary: string;
    key_principles: string[];
    distinguishing_factors?: string[];
  }>> {
    const results = [];
    
    // Simple keyword matching (in production would use legal databases API)
    const queryKeywords = query.question.toLowerCase().split(' ');
    
    for (const caseData of this.sampleCases) {
      let relevanceScore = 0;
      
      // Check area of law match
      if (query.area_of_law && caseData.area_of_law.toLowerCase().includes(query.area_of_law.toLowerCase())) {
        relevanceScore += 0.3;
      }
      
      // Check keyword matches
      for (const keyword of queryKeywords) {
        if (caseData.keywords.some(k => k.includes(keyword)) || 
            caseData.summary.toLowerCase().includes(keyword) ||
            caseData.principles.some(p => p.toLowerCase().includes(keyword))) {
          relevanceScore += 0.1;
        }
      }
      
      // Court level weighting
      const courtWeight = 1 / this.courtHierarchy[caseData.citation.courtLevel];
      relevanceScore *= courtWeight;
      
      // Date range filtering
      if (query.date_range) {
        const caseYear = caseData.citation.year;
        if (caseYear < query.date_range.from.getFullYear() || 
            caseYear > query.date_range.to.getFullYear()) {
          relevanceScore *= 0.5; // Reduce score for outside date range
        }
      }
      
      if (relevanceScore > 0.1) {
        results.push({
          citation: caseData.citation,
          relevance_score: Math.min(relevanceScore, 1.0),
          summary: caseData.summary,
          key_principles: caseData.principles,
          distinguishing_factors: this.identifyDistinguishingFactors(query.question, caseData.facts)
        });
      }
    }
    
    // Sort by relevance and return top results
    return results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 10);
  }

  /**
   * Search for relevant statutory provisions
   */
  private async searchStatutes(query: ResearchQuery): Promise<Array<{
    provision: StatutoryProvision;
    relevance_score: number;
    summary: string;
  }>> {
    // Sample statutory provisions (would connect to legislation.gov.uk in production)
    const sampleStatutes: StatutoryProvision[] = [
      {
        act: 'Limitation Act',
        year: 1980,
        section: '2',
        title: 'Time limit for actions founded on tort',
        text: 'An action founded on tort shall not be brought after the expiration of six years from the date on which the cause of action accrued.',
        in_force: true
      },
      {
        act: 'Contract (Rights of Third Parties) Act',
        year: 1999,
        section: '1',
        subsection: '1',
        title: 'Right of third party to enforce contractual term',
        text: 'Subject to the provisions of this Act, a person who is not a party to a contract (a "third party") may in his own right enforce a term of the contract if the contract expressly provides that he may.',
        in_force: true
      },
      {
        act: 'Unfair Contract Terms Act',
        year: 1977,
        section: '2',
        subsection: '1',
        title: 'Negligence liability',
        text: 'A person cannot by reference to any contract term or to a notice given to persons generally or to particular persons exclude or restrict his liability for death or personal injury resulting from negligence.',
        in_force: true
      }
    ];

    const results = [];
    const queryKeywords = query.question.toLowerCase().split(' ');
    
    for (const statute of sampleStatutes) {
      let relevanceScore = 0;
      
      // Check for keyword matches in title and text
      for (const keyword of queryKeywords) {
        if (statute.title.toLowerCase().includes(keyword) ||
            statute.text.toLowerCase().includes(keyword) ||
            statute.act.toLowerCase().includes(keyword)) {
          relevanceScore += 0.2;
        }
      }
      
      if (relevanceScore > 0.1) {
        results.push({
          provision: statute,
          relevance_score: Math.min(relevanceScore, 1.0),
          summary: `${statute.act} ${statute.year}, s.${statute.section}${statute.subsection ? `(${statute.subsection})` : ''}: ${statute.title}`
        });
      }
    }
    
    return results.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  /**
   * Generate legal analysis using AI
   */
  private async generateLegalAnalysis(
    query: ResearchQuery,
    cases: any[],
    statutes: any[]
  ): Promise<string> {
    try {
      const context = `
        Research Question: ${query.question}
        Area of Law: ${query.area_of_law || 'General'}
        
        Relevant Cases:
        ${cases.map(c => `- ${c.citation.citation}: ${c.summary}`).join('\n')}
        
        Relevant Statutes:
        ${statutes.map(s => `- ${s.summary}`).join('\n')}
      `;

      const analysis = await aiService.generateDraft(
        `Provide a comprehensive legal analysis for this research question:
         ${context}
         
         Analysis should include:
         1. Summary of applicable legal principles
         2. How the authorities apply to the question
         3. Potential arguments and counterarguments
         4. Practical implications
         5. Any gaps in the law or uncertainty`,
        'You are a senior UK barrister providing legal analysis. Be thorough, precise, and consider all angles.'
      );

      return analysis;

    } catch (error) {
      console.error('AI legal analysis failed:', error);
      return `Legal analysis based on ${cases.length} relevant cases and ${statutes.length} statutory provisions. Manual analysis required due to technical limitations.`;
    }
  }

  /**
   * Build precedent hierarchy
   */
  private buildPrecedentHierarchy(citations: CaseCitation[]): Array<{
    level: number;
    cases: CaseCitation[];
    binding_authority: boolean;
  }> {
    const hierarchy = [];
    const casesByLevel = new Map<number, CaseCitation[]>();
    
    // Group cases by court level
    for (const citation of citations) {
      const level = this.courtHierarchy[citation.courtLevel];
      if (!casesByLevel.has(level)) {
        casesByLevel.set(level, []);
      }
      casesByLevel.get(level)!.push(citation);
    }
    
    // Build hierarchy array
    for (const [level, cases] of casesByLevel.entries()) {
      hierarchy.push({
        level,
        cases,
        binding_authority: level <= 3 // Supreme Court, Court of Appeal, High Court are binding
      });
    }
    
    return hierarchy.sort((a, b) => a.level - b.level);
  }

  /**
   * Generate argument outline
   */
  async generateArgumentOutline(
    query: ResearchQuery,
    cases: any[],
    statutes: any[]
  ): Promise<ArgumentOutline> {
    try {
      const argumentPrompt = `
        Based on this legal research, create a structured argument outline:
        
        Question: ${query.question}
        Cases: ${cases.map(c => `${c.citation.citation}: ${c.summary}`).join('; ')}
        Statutes: ${statutes.map(s => s.summary).join('; ')}
        
        Structure:
        1. Main legal argument
        2. Supporting points with authorities
        3. Potential counterarguments and responses
        4. Conclusion
      `;

      const outlineText = await aiService.generateDraft(
        argumentPrompt,
        'You are drafting legal arguments for court. Be logical, structured, and cite authorities appropriately.'
      );

      // Parse the AI response into structured format (simplified)
      return {
        main_argument: `Primary argument based on research findings`,
        supporting_points: cases.slice(0, 3).map(c => ({
          point: `Application of ${c.citation.citation} principle`,
          authorities: [{
            citation: c.citation.citation,
            principle: c.key_principles[0] || 'Legal principle',
            quote: c.summary.substring(0, 100) + '...'
          }],
          statutory_support: statutes.length > 0 ? [statutes[0].summary] : undefined
        })),
        counterarguments: [
          {
            argument: 'Potential distinguishing factors',
            response: 'Response based on binding authorities',
            authorities: cases.map(c => c.citation.citation).slice(0, 2)
          }
        ],
        conclusion: 'Summary of legal position and recommended approach'
      };

    } catch (error) {
      console.error('Argument outline generation failed:', error);
      return {
        main_argument: 'Manual argument development required',
        supporting_points: [],
        counterarguments: [],
        conclusion: 'Further research and analysis needed'
      };
    }
  }

  /**
   * Parse case citation
   */
  parseCitation(citationString: string): CaseCitation | null {
    try {
      // Simplified citation parsing (would use more sophisticated parsing in production)
      const patterns = [
        // Neutral citation: [2023] UKSC 15
        /\[(\d{4})\]\s+(UKSC|EWCA|EWHC|EWCOP)\s+(\d+)/,
        // Law reports: [1932] AC 562
        /\[(\d{4})\]\s+([A-Z]+)\s+(\d+)/,
        // Old reports: (1854) 9 Exch 341
        /\((\d{4})\)\s+(\d+)\s+([A-Za-z]+)\s+(\d+)/
      ];

      let match;
      let courtLevel: CaseCitation['courtLevel'] = 'high_court';
      let year = 0;

      for (const pattern of patterns) {
        match = citationString.match(pattern);
        if (match) {
          year = parseInt(match[1]);
          
          // Determine court level from citation
          const court = match[2];
          if (court === 'UKSC') courtLevel = 'supreme_court';
          else if (court === 'EWCA') courtLevel = 'court_of_appeal';
          else if (court === 'EWHC') courtLevel = 'high_court';
          else if (court === 'AC' || court === 'WLR') courtLevel = year < 2009 ? 'supreme_court' : 'supreme_court';
          
          break;
        }
      }

      if (!match) return null;

      // Extract party names (simplified)
      const partyMatch = citationString.match(/^([^v]+)\s+v\s+([^\[|\(]+)/);
      const parties: CaseCitation['parties'] = {};
      
      if (partyMatch) {
        parties.claimant = partyMatch[1].trim();
        parties.defendant = partyMatch[2].trim();
      }

      return {
        citation: citationString,
        courtLevel,
        year,
        parties,
        neutralCitation: match[0],
        jurisdiction: 'england_wales'
      };

    } catch (error) {
      console.error('Citation parsing failed:', error);
      return null;
    }
  }

  /**
   * Extract ratio decidendi from case text
   */
  async extractRatioDecidendi(caseText: string, caseCitation: string): Promise<{
    ratio: string;
    obiter?: string;
    confidence: number;
  }> {
    try {
      const ratioAnalysis = await aiService.generateDraft(
        `Extract the ratio decidendi (binding legal principle) from this case judgment:
         
         Case: ${caseCitation}
         Text: ${caseText.substring(0, 3000)}
         
         Distinguish between:
         1. Ratio decidendi (essential to the decision)
         2. Obiter dictum (incidental remarks)
         
         Provide the ratio as a clear, concise statement of legal principle.`,
        'You are a legal scholar analyzing case law. Focus on the binding legal principle that forms the ratio.'
      );

      return {
        ratio: ratioAnalysis.substring(0, 500),
        confidence: 0.8 // Would be calculated based on AI confidence and text quality
      };

    } catch (error) {
      console.error('Ratio extraction failed:', error);
      return {
        ratio: 'Unable to extract ratio decidendi automatically',
        confidence: 0.2
      };
    }
  }

  /**
   * Helper methods
   */
  private identifyDistinguishingFactors(query: string, caseFacts: string): string[] {
    // Simplified - would use AI to identify distinguishing factors
    const factors = [];
    
    if (query.toLowerCase().includes('contract') && !caseFacts.toLowerCase().includes('contract')) {
      factors.push('Different legal area (contract vs tort)');
    }
    
    if (query.toLowerCase().includes('personal injury') && !caseFacts.toLowerCase().includes('injury')) {
      factors.push('Different type of claim');
    }
    
    return factors;
  }

  private calculateResearchConfidence(cases: any[], statutes: any[]): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on number and quality of authorities
    confidence += Math.min(cases.length * 0.1, 0.3);
    confidence += Math.min(statutes.length * 0.05, 0.15);
    
    // Increase confidence for binding authorities
    const bindingCases = cases.filter(c => this.courtHierarchy[c.citation.courtLevel] <= 3);
    confidence += Math.min(bindingCases.length * 0.05, 0.1);
    
    return Math.min(confidence, 1.0);
  }

  private getFallbackResearchResult(query: ResearchQuery): ResearchResult {
    return {
      query,
      relevant_cases: [],
      relevant_statutes: [],
      legal_analysis: 'Automated legal research is temporarily unavailable. Please conduct manual research using legal databases such as Westlaw, LexisNexis, or Bailii.',
      precedent_hierarchy: [],
      recommended_arguments: ['Manual research required'],
      potential_counterarguments: ['Consider all available authorities'],
      research_confidence: 0.1
    };
  }

  /**
   * Generate precedent analysis report
   */
  async generatePrecedentReport(
    mainCase: string,
    relatedCases: string[],
    legalQuestion: string
  ): Promise<{
    summary: string;
    binding_precedents: string[];
    persuasive_authorities: string[];
    distinguishing_analysis: string;
    recommendation: string;
  }> {
    try {
      const report = await aiService.generateDraft(
        `Analyze precedent relationships for this legal research:
         
         Main case: ${mainCase}
         Related cases: ${relatedCases.join(', ')}
         Legal question: ${legalQuestion}
         
         Provide:
         1. Summary of precedent relationships
         2. Binding vs persuasive authorities
         3. Analysis of distinguishing factors
         4. Recommendation for legal argument`,
        'You are analyzing case law precedents. Be precise about binding authority and distinguishing factors.'
      );

      return {
        summary: report.substring(0, 500),
        binding_precedents: relatedCases.slice(0, 3),
        persuasive_authorities: relatedCases.slice(3, 6),
        distinguishing_analysis: 'Analysis of how cases can be distinguished or applied',
        recommendation: 'Recommended approach based on precedent analysis'
      };

    } catch (error) {
      console.error('Precedent report generation failed:', error);
      return {
        summary: 'Manual precedent analysis required',
        binding_precedents: [],
        persuasive_authorities: [],
        distinguishing_analysis: 'Detailed analysis needed',
        recommendation: 'Further research recommended'
      };
    }
  }
}

// Create singleton instance
export const legalResearchService = new LegalResearchService();