import { XMLParser } from 'fast-xml-parser';

interface LegislationSearchResult {
  id: string;
  title: string;
  year: string;
  number: string;
  type: string;
  uri: string;
  description?: string;
  lastModified?: string;
  inForce: boolean;
}

interface LegislationSection {
  id: string;
  title: string;
  content: string;
  uri: string;
  subsections?: LegislationSection[];
}

interface CaseUpdate {
  title: string;
  citation: string;
  court: string;
  date: string;
  summary: string;
  relevantActs: string[];
}

interface CompanyInfo {
  companyNumber: string;
  companyName: string;
  companyStatus: string;
  incorporationDate: string;
  companyType: string;
  registeredOffice: {
    addressLine1: string;
    addressLine2?: string;
    locality: string;
    postalCode: string;
    country: string;
  };
  officers: Array<{
    name: string;
    role: string;
    appointedOn: string;
    nationality?: string;
  }>;
}

export class LegalAPIsService {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  // 1. UK LEGISLATION API - legislation.gov.uk
  async searchLegislation(query: string, type?: string): Promise<LegislationSearchResult[]> {
    try {
      const searchUrl = `https://www.legislation.gov.uk/search`;
      const params = new URLSearchParams({
        title: query,
        ...(type && { type }),
        format: 'atom',
      });

      const response = await fetch(`${searchUrl}?${params}`);
      if (!response.ok) throw new Error('Legislation search failed');

      const xmlData = await response.text();
      const parsed = this.xmlParser.parse(xmlData);

      // Parse Atom feed results
      const entries = parsed.feed?.entry || [];

      return entries.map((entry: any) => ({
        id: entry.id,
        title: entry.title,
        uri: entry.link?.['@_href'] || '',
        year: this.extractYearFromUri(entry.id),
        number: this.extractNumberFromUri(entry.id),
        type: this.extractTypeFromUri(entry.id),
        description: entry.summary,
        lastModified: entry.updated,
        inForce: true, // Would need additional logic to determine
      }));
    } catch (error) {
      console.error('Legislation search error:', error);
      return [];
    }
  }

  async getLegislationContent(uri: string): Promise<LegislationSection | null> {
    try {
      // Get XML data for full content
      const xmlUrl = `${uri}/data.xml`;
      const response = await fetch(xmlUrl);

      if (!response.ok) throw new Error('Failed to fetch legislation content');

      const xmlData = await response.text();
      const parsed = this.xmlParser.parse(xmlData);

      const legislation = parsed.Legislation;

      return {
        id: legislation['@_IdURI'],
        title: legislation['ukm:Metadata']['dc:title'],
        content: this.extractSections(legislation),
        uri: uri,
        subsections: this.parseSections(legislation),
      };
    } catch (error) {
      console.error('Get legislation content error:', error);
      return null;
    }
  }

  async getSpecificSection(act: string, section: string): Promise<string | null> {
    try {
      // Example: /ukpga/2010/15/section/39 for Equality Act 2010 s.39
      const sectionUrl = `https://www.legislation.gov.uk${act}/section/${section}/data.xml`;
      const response = await fetch(sectionUrl);

      if (!response.ok) return null;

      const xmlData = await response.text();
      const parsed = this.xmlParser.parse(xmlData);

      return this.extractSectionText(parsed);
    } catch (error) {
      console.error('Get specific section error:', error);
      return null;
    }
  }

  // 2. COMPANIES HOUSE API
  async getCompanyInfo(companyNumber: string): Promise<CompanyInfo | null> {
    try {
      // Note: Requires Companies House API key
      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        console.warn('Companies House API key not configured');
        return null;
      }

      const response = await fetch(
        `https://api.company-information.service.gov.uk/company/${companyNumber}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          },
        },
      );

      if (!response.ok) throw new Error('Company lookup failed');

      const data = await response.json();

      // Get officers information
      const officersResponse = await fetch(
        `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          },
        },
      );

      const officersData = officersResponse.ok ? await officersResponse.json() : { items: [] };

      return {
        companyNumber: data.company_number,
        companyName: data.company_name,
        companyStatus: data.company_status,
        incorporationDate: data.date_of_creation,
        companyType: data.type,
        registeredOffice: {
          addressLine1: data.registered_office_address.address_line_1,
          addressLine2: data.registered_office_address.address_line_2,
          locality: data.registered_office_address.locality,
          postalCode: data.registered_office_address.postal_code,
          country: data.registered_office_address.country,
        },
        officers:
          officersData.items?.map((officer: any) => ({
            name: officer.name,
            role: officer.officer_role,
            appointedOn: officer.appointed_on,
            nationality: officer.nationality,
          })) || [],
      };
    } catch (error) {
      console.error('Company lookup error:', error);
      return null;
    }
  }

  // 3. COURT SERVICE API (Mock - would integrate with real HMCTS APIs)
  async getRecentCases(area: string, _limit: number = 10): Promise<CaseUpdate[]> {
    // This would integrate with HMCTS Find Case Law or similar
    // For now, return mock data structure
    return [
      {
        title: 'Smith v Jones Employment Tribunal',
        citation: '[2024] UKET 123456',
        court: 'Employment Tribunal',
        date: '2024-08-15',
        summary: 'Pregnancy discrimination case - successful claim under Equality Act 2010',
        relevantActs: ['Equality Act 2010'],
      },
    ];
  }

  // 4. GOVERNMENT NOTIFICATIONS API (GOV.UK Notify)
  async sendLegalNotification(
    templateId: string,
    recipient: string,
    personalisation: Record<string, string>,
  ): Promise<boolean> {
    try {
      const apiKey = process.env.GOVUK_NOTIFY_API_KEY;
      if (!apiKey) {
        console.warn('GOV.UK Notify API key not configured');
        return false;
      }

      const response = await fetch(
        'https://api.notifications.service.gov.uk/v2/notifications/email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `ApiKey-v1 ${apiKey}`,
          },
          body: JSON.stringify({
            email_address: recipient,
            template_id: templateId,
            personalisation,
          }),
        },
      );

      return response.ok;
    } catch (error) {
      console.error('Notification send error:', error);
      return false;
    }
  }

  // 5. AI-ENHANCED LEGAL RESEARCH
  async enhanceAIAnalysisWithLegalData(
    analysisQuery: string,
    caseType: string,
  ): Promise<{
    relevantLegislation: LegislationSearchResult[];
    recentCases: CaseUpdate[];
    additionalContext: string;
  }> {
    const promises = [];

    // Search for relevant legislation based on case type
    if (caseType === 'employment') {
      promises.push(this.searchLegislation('Employment Rights Act'));
      promises.push(this.searchLegislation('Equality Act'));
      promises.push(this.searchLegislation('Trade Union'));
    } else if (caseType === 'data-protection') {
      promises.push(this.searchLegislation('Data Protection Act'));
      promises.push(this.searchLegislation('GDPR'));
    } else {
      promises.push(this.searchLegislation(analysisQuery));
    }

    // Get recent cases
    promises.push(this.getRecentCases(caseType));

    const results = await Promise.allSettled(promises);

    const relevantLegislation = results
      .slice(0, -1)
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<LegislationSearchResult[]>).value);

    const recentCases =
      results[results.length - 1].status === 'fulfilled'
        ? (results[results.length - 1] as PromiseFulfilledResult<CaseUpdate[]>).value
        : [];

    return {
      relevantLegislation,
      recentCases,
      additionalContext: this.buildAdditionalContext(relevantLegislation, recentCases),
    };
  }

  // 6. REAL-TIME LEGAL VERIFICATION
  async verifyLegalCitation(citation: string): Promise<{
    valid: boolean;
    fullReference: string;
    currentStatus: string;
    lastAmended?: string;
  }> {
    try {
      // Parse citation to extract act and section
      const citationMatch = citation.match(/(.+?)\s+(\d{4})\s*(?:s\.?\s*(\d+))?/);
      if (!citationMatch) {
        return { valid: false, fullReference: citation, currentStatus: 'Invalid citation format' };
      }

      const [, actName, year, section] = citationMatch;

      // Search for the legislation
      const searchResults = await this.searchLegislation(`${actName} ${year}`);
      if (searchResults.length === 0) {
        return { valid: false, fullReference: citation, currentStatus: 'Act not found' };
      }

      const act = searchResults[0];

      // If section specified, verify it exists
      if (section) {
        const sectionContent = await this.getSpecificSection(
          act.uri.replace('https://www.legislation.gov.uk', ''),
          section,
        );

        if (!sectionContent) {
          return {
            valid: false,
            fullReference: `${act.title}, s.${section}`,
            currentStatus: 'Section not found',
          };
        }
      }

      return {
        valid: true,
        fullReference: section ? `${act.title}, s.${section}` : act.title,
        currentStatus: act.inForce ? 'In force' : 'Not in force',
        lastAmended: act.lastModified,
      };
    } catch (error) {
      console.error('Legal verification error:', error);
      return { valid: false, fullReference: citation, currentStatus: 'Verification failed' };
    }
  }

  // Helper methods
  private extractYearFromUri(uri: string): string {
    const match = uri.match(/\/(\d{4})\//);
    return match ? match[1] : '';
  }

  private extractNumberFromUri(uri: string): string {
    const match = uri.match(/\/(\d+)$/);
    return match ? match[1] : '';
  }

  private extractTypeFromUri(uri: string): string {
    const match = uri.match(/\/(ukpga|uksi|ukla|ukcm)/);
    return match ? match[1] : 'unknown';
  }

  private extractSections(_legislation: any): string {
    // Extract readable content from legislation XML
    // This is a simplified version - full implementation would handle complex XML structure
    return 'Full legislation content would be extracted here';
  }

  private parseSections(_legislation: any): LegislationSection[] {
    // Parse sections and subsections from legislation XML
    return [];
  }

  private extractSectionText(_parsed: any): string {
    // Extract specific section text from XML
    return 'Section content would be extracted here';
  }

  private buildAdditionalContext(
    legislation: LegislationSearchResult[],
    cases: CaseUpdate[],
  ): string {
    const context = [];

    if (legislation.length > 0) {
      context.push(`Relevant legislation: ${legislation.map((l) => l.title).join(', ')}`);
    }

    if (cases.length > 0) {
      context.push(`Recent cases: ${cases.map((c) => c.title).join(', ')}`);
    }

    return context.join('\n');
  }
}

export const legalAPIs = new LegalAPIsService();
