import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

interface CompanyInfo {
  company_number: string;
  company_name: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  registered_office_address: any;
  officers?: any[];
  filing_history?: any[];
  charges?: any[];
}

interface LegislationData {
  title: string;
  url: string;
  sections: any[];
  amendments: any[];
  effective_date: string;
}

interface CourtCase {
  name: string;
  citation: string;
  court: string;
  date: string;
  summary: string;
  full_text?: string;
  related_cases: string[];
}

interface LandRegistryData {
  title_number: string;
  address: string;
  proprietor: string;
  tenure: string;
  price_paid?: number;
  charges?: any[];
}

interface GovernmentService {
  name: string;
  url: string;
  description: string;
  eligibility?: string[];
  process?: string[];
}

export class UKLegalAPIs {
  private companiesHouseAPI: AxiosInstance;
  private companiesHouseKey: string;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTimeout: number = 3600000; // 1 hour

  constructor() {
    this.companiesHouseKey = process.env.COMPANIES_HOUSE_API_KEY || '';
    this.cache = new Map();

    // Initialize Companies House API client
    this.companiesHouseAPI = axios.create({
      baseURL: 'https://api.company-information.service.gov.uk',
      auth: {
        username: this.companiesHouseKey,
        password: '',
      },
      headers: {
        Accept: 'application/json',
      },
    });
  }

  // ============ COMPANIES HOUSE API ============
  async searchCompany(query: string): Promise<CompanyInfo[]> {
    const cacheKey = `company_search_${query}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.companiesHouseAPI.get('/search/companies', {
        params: { q: query, items_per_page: 20 },
      });

      const companies = response.data.items.map((item: any) => ({
        company_number: item.company_number,
        company_name: item.title,
        company_status: item.company_status,
        company_type: item.company_type,
        date_of_creation: item.date_of_creation,
        registered_office_address: item.address,
      }));

      this.setCache(cacheKey, companies);
      return companies;
    } catch (error) {
      console.error('Companies House search error:', error);
      // Fallback to mock data for development
      return this.getMockCompanyData(query);
    }
  }

  async getCompanyDetails(companyNumber: string): Promise<CompanyInfo> {
    const cacheKey = `company_${companyNumber}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const [company, officers, filings, charges] = await Promise.all([
        this.companiesHouseAPI.get(`/company/${companyNumber}`),
        this.companiesHouseAPI.get(`/company/${companyNumber}/officers`),
        this.companiesHouseAPI.get(`/company/${companyNumber}/filing-history`),
        this.companiesHouseAPI.get(`/company/${companyNumber}/charges`),
      ]);

      const companyInfo: CompanyInfo = {
        ...company.data,
        officers: officers.data.items,
        filing_history: filings.data.items,
        charges: charges.data.items,
      };

      this.setCache(cacheKey, companyInfo);
      return companyInfo;
    } catch (error) {
      console.error('Company details error:', error);
      return this.getMockCompanyData(companyNumber)[0];
    }
  }

  // ============ LEGISLATION.GOV.UK API ============
  async searchLegislation(
    query: string,
    type?: 'ukpga' | 'uksi' | 'ukdsi',
  ): Promise<LegislationData[]> {
    const cacheKey = `legislation_${query}_${type}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const searchUrl = `https://www.legislation.gov.uk/api/search?query=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: { Accept: 'application/json' },
      });

      const results = response.data.results.map((item: any) => ({
        title: item.title,
        url: item.url,
        sections: [],
        amendments: [],
        effective_date: item.effective_date,
      }));

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Legislation search error:', error);
      return this.getMockLegislationData(query);
    }
  }

  async getLegislationDetails(url: string): Promise<LegislationData> {
    const cacheKey = `legislation_detail_${url}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${url}/data.json`, {
        headers: { Accept: 'application/json' },
      });

      const legislation: LegislationData = {
        title: response.data.title,
        url: url,
        sections: response.data.sections || [],
        amendments: response.data.amendments || [],
        effective_date: response.data.effective_date,
      };

      this.setCache(cacheKey, legislation);
      return legislation;
    } catch (error) {
      console.error('Legislation details error:', error);
      return this.getMockLegislationData(url)[0];
    }
  }

  // ============ BAILII CASE LAW ============
  async searchCaseLaw(query: string, court?: string): Promise<CourtCase[]> {
    const cacheKey = `case_law_${query}_${court}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const searchUrl = `https://www.bailii.org/cgi-bin/find_all.cgi`;
      const params = new URLSearchParams({
        query: query,
        method: 'boolean',
        format: 'brief',
      });

      if (court) params.append('court', court);

      const response = await axios.get(`${searchUrl}?${params.toString()}`);
      const $ = cheerio.load(response.data);

      const cases: CourtCase[] = [];
      $('li').each((i, elem) => {
        const link = $(elem).find('a');
        const text = $(elem).text();

        if (link.length > 0) {
          const citation = text.match(/\[(\d{4})\]\s+[A-Z]+\s+\d+/) || [''];
          cases.push({
            name: link.text(),
            citation: citation[0],
            court: this.extractCourt(text),
            date: this.extractDate(text),
            summary: text.substring(0, 200),
            related_cases: [],
          });
        }
      });

      this.setCache(cacheKey, cases);
      return cases;
    } catch (error) {
      console.error('Case law search error:', error);
      return this.getMockCaseLawData(query);
    }
  }

  // ============ LAND REGISTRY API ============
  async searchLandRegistry(address: string): Promise<LandRegistryData[]> {
    const cacheKey = `land_registry_${address}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Note: Real Land Registry API requires authentication and payment
      // This is a placeholder for the actual implementation
      const response = await axios.post(
        'https://api.landregistry.gov.uk/v1/search',
        { address },
        {
          headers: {
            Authorization: `Bearer ${process.env.LAND_REGISTRY_API_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const results = response.data.results.map((item: any) => ({
        title_number: item.title_number,
        address: item.address,
        proprietor: item.proprietor,
        tenure: item.tenure,
        price_paid: item.price_paid,
        charges: item.charges || [],
      }));

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Land Registry search error:', error);
      return this.getMockLandRegistryData(address);
    }
  }

  // ============ GOV.UK SERVICES API ============
  async searchGovernmentServices(query: string): Promise<GovernmentService[]> {
    const cacheKey = `gov_services_${query}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(
        `https://www.gov.uk/api/search.json?q=${encodeURIComponent(query)}`,
      );

      const services = response.data.results.map((item: any) => ({
        name: item.title,
        url: item.link,
        description: item.description,
        eligibility: [],
        process: [],
      }));

      this.setCache(cacheKey, services);
      return services;
    } catch (error) {
      console.error('Gov.uk search error:', error);
      return this.getMockGovernmentServices(query);
    }
  }

  // ============ HMCTS COURT DATA ============
  async getCourtDetails(courtName: string): Promise<any> {
    const cacheKey = `court_${courtName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(
        `https://www.find-court-tribunal.service.gov.uk/api/courts/${encodeURIComponent(courtName)}`,
      );

      const courtData = {
        name: response.data.name,
        address: response.data.address,
        contact: response.data.contact,
        opening_times: response.data.opening_times,
        facilities: response.data.facilities,
        areas_of_law: response.data.areas_of_law,
      };

      this.setCache(cacheKey, courtData);
      return courtData;
    } catch (error) {
      console.error('Court details error:', error);
      return this.getMockCourtData(courtName);
    }
  }

  // ============ LEGAL AID AGENCY ============
  async checkLegalAidEligibility(income: number, capital: number, caseType: string): Promise<any> {
    const cacheKey = `legal_aid_${income}_${capital}_${caseType}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Legal Aid thresholds (simplified)
    const eligibility = {
      eligible: false,
      reason: '',
      contribution: 0,
      passported: false,
    };

    // Income thresholds
    if (income < 12475) {
      eligibility.eligible = true;
      eligibility.reason = 'Income below lower threshold';
    } else if (income < 25000) {
      eligibility.eligible = true;
      eligibility.contribution = Math.floor((income - 12475) * 0.3);
      eligibility.reason = 'Income requires contribution';
    } else {
      eligibility.reason = 'Income above upper threshold';
    }

    // Capital thresholds
    if (capital > 8000) {
      eligibility.eligible = false;
      eligibility.reason = 'Capital above threshold';
    }

    this.setCache(cacheKey, eligibility);
    return eligibility;
  }

  // ============ UTILITY FUNCTIONS ============
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private extractCourt(text: string): string {
    const courts = ['UKSC', 'UKHL', 'EWCA', 'EWHC', 'UKUT', 'UKFTT'];
    for (const court of courts) {
      if (text.includes(court)) return court;
    }
    return 'Unknown';
  }

  private extractDate(text: string): string {
    const dateMatch = text.match(/\d{1,2}\s+\w+\s+\d{4}/);
    return dateMatch ? dateMatch[0] : '';
  }

  // ============ MOCK DATA FOR DEVELOPMENT ============
  private getMockCompanyData(query: string): CompanyInfo[] {
    return [
      {
        company_number: '12345678',
        company_name: `${query} Limited`,
        company_status: 'active',
        company_type: 'ltd',
        date_of_creation: '2020-01-01',
        registered_office_address: {
          premises: '123',
          address_line_1: 'Mock Street',
          locality: 'London',
          postal_code: 'SW1A 1AA',
        },
        officers: [{ name: 'John Doe', role: 'director', appointed_on: '2020-01-01' }],
        filing_history: [],
        charges: [],
      },
    ];
  }

  private getMockLegislationData(query: string): LegislationData[] {
    return [
      {
        title: `${query} Act 2024`,
        url: 'https://www.legislation.gov.uk/ukpga/2024/1',
        sections: [
          { number: '1', title: 'Definitions' },
          { number: '2', title: 'Scope' },
        ],
        amendments: [],
        effective_date: '2024-01-01',
      },
    ];
  }

  private getMockCaseLawData(query: string): CourtCase[] {
    return [
      {
        name: `Re ${query}`,
        citation: '[2024] EWHC 123',
        court: 'EWHC',
        date: '15 January 2024',
        summary: `Case concerning ${query}. The court held that...`,
        related_cases: ['[2023] EWCA Civ 456'],
      },
    ];
  }

  private getMockLandRegistryData(address: string): LandRegistryData[] {
    return [
      {
        title_number: 'ABC123456',
        address: address,
        proprietor: 'John Smith',
        tenure: 'Freehold',
        price_paid: 250000,
        charges: [],
      },
    ];
  }

  private getMockGovernmentServices(query: string): GovernmentService[] {
    return [
      {
        name: `${query} Service`,
        url: 'https://www.gov.uk/example',
        description: `Information about ${query}`,
        eligibility: ['UK resident', 'Over 18'],
        process: ['Apply online', 'Submit documents', 'Wait for decision'],
      },
    ];
  }

  private getMockCourtData(courtName: string): any {
    return {
      name: courtName,
      address: {
        line1: '123 Justice Street',
        town: 'London',
        postcode: 'SW1A 1AA',
      },
      contact: {
        phone: '020 7123 4567',
        email: 'enquiries@court.gov.uk',
      },
      opening_times: {
        monday: '9:00-17:00',
        tuesday: '9:00-17:00',
        wednesday: '9:00-17:00',
        thursday: '9:00-17:00',
        friday: '9:00-17:00',
      },
      facilities: ['Disabled access', 'Parking', 'Baby changing'],
      areas_of_law: ['Civil', 'Family', 'Criminal'],
    };
  }
}

export const ukLegalAPIs = new UKLegalAPIs();
