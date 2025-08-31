import { addDays, addWeeks, addMonths, addYears, isWeekend, format, startOfDay } from 'date-fns';
import { aiService } from './ai.js';

export interface Deadline {
  id: string;
  caseId: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'court' | 'limitation' | 'statutory' | 'administrative' | 'client';
  source: string; // CPR rule, statute, etc.
  status: 'pending' | 'completed' | 'overdue';
  reminderDays: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LimitationPeriod {
  type: 'contract' | 'tort' | 'personal_injury' | 'defamation' | 'breach_of_trust' | 'specialty';
  years: number;
  description: string;
  statute: string;
}

export interface CourtDeadlineRule {
  name: string;
  rule: string;
  description: string;
  daysFromEvent: number;
  excludeWeekends: boolean;
  excludePublicHolidays: boolean;
  canExtend: boolean;
  extensionCriteria?: string;
}

class DeadlineCalculatorService {
  
  // UK Civil Procedure Rules deadlines
  private courtDeadlines: CourtDeadlineRule[] = [
    {
      name: 'Acknowledgment of Service',
      rule: 'CPR 10.3',
      description: 'Time to file acknowledgment after service of claim form',
      daysFromEvent: 14,
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: false
    },
    {
      name: 'Defence',
      rule: 'CPR 15.4',
      description: 'Time to file defence after service of particulars',
      daysFromEvent: 14,
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: true,
      extensionCriteria: 'Up to 28 days by agreement with all parties'
    },
    {
      name: 'Reply to Defence',
      rule: 'CPR 15.8',
      description: 'Time to file reply after defence served',
      daysFromEvent: 14,
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: true
    },
    {
      name: 'Directions Questionnaire',
      rule: 'CPR 26.3',
      description: 'Time to file directions questionnaire',
      daysFromEvent: 14,
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: false
    },
    {
      name: 'Case Management Conference',
      rule: 'CPR 29.2',
      description: 'Response time for case management directions',
      daysFromEvent: 7,
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: false
    },
    {
      name: 'Witness Statements',
      rule: 'CPR 32.4',
      description: 'Exchange of witness statements (court ordered)',
      daysFromEvent: 0, // Variable - set by court order
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: true,
      extensionCriteria: 'Application to court required'
    },
    {
      name: 'Expert Evidence',
      rule: 'CPR 35.13',
      description: 'Exchange of expert reports',
      daysFromEvent: 0, // Variable - set by court order
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: true,
      extensionCriteria: 'Application to court required'
    },
    {
      name: 'Pre-trial Checklist',
      rule: 'CPR 29.6',
      description: 'Filing of pre-trial checklist (listing questionnaire)',
      daysFromEvent: 8, // 8 weeks before trial
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: false
    },
    {
      name: 'Bundle Preparation',
      rule: 'CPR PD 39A',
      description: 'Trial bundle preparation and filing',
      daysFromEvent: 7, // 3-7 days before trial
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: false
    },
    {
      name: 'Appeal Notice',
      rule: 'CPR 52.12',
      description: 'Time to file appeal notice',
      daysFromEvent: 21,
      excludeWeekends: true,
      excludePublicHolidays: true,
      canExtend: true,
      extensionCriteria: 'Application for extension required'
    }
  ];

  // UK Limitation periods
  private limitationPeriods: LimitationPeriod[] = [
    {
      type: 'contract',
      years: 6,
      description: 'Simple contracts and tort claims',
      statute: 'Limitation Act 1980, s.5'
    },
    {
      type: 'personal_injury',
      years: 3,
      description: 'Personal injury claims',
      statute: 'Limitation Act 1980, s.11'
    },
    {
      type: 'defamation',
      years: 1,
      description: 'Defamation claims',
      statute: 'Limitation Act 1980, s.4A'
    },
    {
      type: 'specialty',
      years: 12,
      description: 'Contracts under seal (deeds)',
      statute: 'Limitation Act 1980, s.8'
    },
    {
      type: 'breach_of_trust',
      years: 6,
      description: 'Breach of trust (where beneficiary in possession)',
      statute: 'Limitation Act 1980, s.21'
    },
    {
      type: 'tort',
      years: 6,
      description: 'General tort claims',
      statute: 'Limitation Act 1980, s.2'
    }
  ];

  // UK Public Holidays (simplified - would need annual updates)
  private publicHolidays2024 = [
    new Date('2024-01-01'), // New Year's Day
    new Date('2024-03-29'), // Good Friday
    new Date('2024-04-01'), // Easter Monday
    new Date('2024-05-06'), // May Day
    new Date('2024-05-27'), // Spring Bank Holiday
    new Date('2024-08-26'), // Summer Bank Holiday
    new Date('2024-12-25'), // Christmas Day
    new Date('2024-12-26'), // Boxing Day
  ];

  /**
   * Calculate business days excluding weekends and public holidays
   */
  private calculateBusinessDay(startDate: Date, daysToAdd: number): Date {
    let currentDate = startOfDay(startDate);
    let daysAdded = 0;

    while (daysAdded < daysToAdd) {
      currentDate = addDays(currentDate, 1);
      
      // Skip weekends
      if (!isWeekend(currentDate)) {
        // Check if it's a public holiday
        const isPublicHoliday = this.publicHolidays2024.some(holiday => 
          format(holiday, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
        );
        
        if (!isPublicHoliday) {
          daysAdded++;
        }
      }
    }

    return currentDate;
  }

  /**
   * Calculate court deadline based on CPR rules
   */
  calculateCourtDeadline(
    eventDate: Date, 
    ruleType: string, 
    customDays?: number
  ): { deadline: Date; rule: CourtDeadlineRule | null } {
    const rule = this.courtDeadlines.find(r => r.name === ruleType);
    
    if (!rule) {
      return {
        deadline: addDays(eventDate, customDays || 14),
        rule: null
      };
    }

    const daysToAdd = customDays || rule.daysFromEvent;
    let deadline: Date;

    if (rule.excludeWeekends && rule.excludePublicHolidays) {
      deadline = this.calculateBusinessDay(eventDate, daysToAdd);
    } else if (rule.excludeWeekends) {
      // Add days excluding weekends only
      let currentDate = startOfDay(eventDate);
      let daysAdded = 0;

      while (daysAdded < daysToAdd) {
        currentDate = addDays(currentDate, 1);
        if (!isWeekend(currentDate)) {
          daysAdded++;
        }
      }
      deadline = currentDate;
    } else {
      deadline = addDays(eventDate, daysToAdd);
    }

    return { deadline, rule };
  }

  /**
   * Calculate limitation period deadline
   */
  calculateLimitationDeadline(
    causeOfActionDate: Date,
    claimType: string
  ): { deadline: Date; limitationPeriod: LimitationPeriod | null } {
    const limitation = this.limitationPeriods.find(l => l.type === claimType);
    
    if (!limitation) {
      // Default to 6 years for unknown claim types
      return {
        deadline: addYears(causeOfActionDate, 6),
        limitationPeriod: null
      };
    }

    const deadline = addYears(causeOfActionDate, limitation.years);
    return { deadline, limitationPeriod: limitation };
  }

  /**
   * Generate comprehensive deadline schedule for a case
   */
  async generateCaseDeadlines(
    caseId: string,
    caseType: 'litigation' | 'personal_injury' | 'commercial' | 'employment',
    keyDates: {
      causeOfAction?: Date;
      claimIssued?: Date;
      serviceDate?: Date;
      defenceDate?: Date;
      trialDate?: Date;
    }
  ): Promise<Deadline[]> {
    const deadlines: Deadline[] = [];
    const now = new Date();

    // 1. Limitation period deadline
    if (keyDates.causeOfAction) {
      const limitationType = caseType === 'personal_injury' ? 'personal_injury' : 'contract';
      const { deadline, limitationPeriod } = this.calculateLimitationDeadline(
        keyDates.causeOfAction,
        limitationType
      );

      if (deadline > now) {
        deadlines.push({
          id: `${caseId}-limitation`,
          caseId,
          title: 'Limitation Period Expires',
          description: `${limitationPeriod?.description || 'Standard limitation period'} expires`,
          dueDate: deadline,
          priority: deadline < addMonths(now, 6) ? 'critical' : 'high',
          category: 'limitation',
          source: limitationPeriod?.statute || 'Limitation Act 1980',
          status: 'pending',
          reminderDays: [365, 180, 90, 30, 14, 7, 1],
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // 2. Court procedural deadlines
    if (keyDates.serviceDate) {
      // Acknowledgment of service deadline
      const { deadline: ackDeadline } = this.calculateCourtDeadline(
        keyDates.serviceDate,
        'Acknowledgment of Service'
      );

      deadlines.push({
        id: `${caseId}-acknowledgment`,
        caseId,
        title: 'Acknowledgment of Service Due',
        description: 'Deadline to file acknowledgment of service',
        dueDate: ackDeadline,
        priority: 'high',
        category: 'court',
        source: 'CPR 10.3',
        status: ackDeadline < now ? 'overdue' : 'pending',
        reminderDays: [7, 3, 1],
        createdAt: now,
        updatedAt: now
      });

      // Defence deadline (14 days from service of particulars)
      const { deadline: defenceDeadline } = this.calculateCourtDeadline(
        keyDates.serviceDate,
        'Defence'
      );

      deadlines.push({
        id: `${caseId}-defence`,
        caseId,
        title: 'Defence Due',
        description: 'Deadline to file defence',
        dueDate: defenceDeadline,
        priority: 'critical',
        category: 'court',
        source: 'CPR 15.4',
        status: defenceDeadline < now ? 'overdue' : 'pending',
        reminderDays: [14, 7, 3, 1],
        createdAt: now,
        updatedAt: now
      });
    }

    // 3. Reply to defence (if defence filed)
    if (keyDates.defenceDate) {
      const { deadline: replyDeadline } = this.calculateCourtDeadline(
        keyDates.defenceDate,
        'Reply to Defence'
      );

      deadlines.push({
        id: `${caseId}-reply`,
        caseId,
        title: 'Reply to Defence Due',
        description: 'Deadline to file reply to defence (if required)',
        dueDate: replyDeadline,
        priority: 'medium',
        category: 'court',
        source: 'CPR 15.8',
        status: replyDeadline < now ? 'overdue' : 'pending',
        reminderDays: [7, 3, 1],
        createdAt: now,
        updatedAt: now
      });
    }

    // 4. Trial preparation deadlines
    if (keyDates.trialDate) {
      // Pre-trial checklist (8 weeks before)
      const preTrialDeadline = addWeeks(keyDates.trialDate, -8);
      deadlines.push({
        id: `${caseId}-pretrial-checklist`,
        caseId,
        title: 'Pre-trial Checklist Due',
        description: 'File listing questionnaire/pre-trial checklist',
        dueDate: preTrialDeadline,
        priority: 'high',
        category: 'court',
        source: 'CPR 29.6',
        status: preTrialDeadline < now ? 'overdue' : 'pending',
        reminderDays: [14, 7, 3, 1],
        createdAt: now,
        updatedAt: now
      });

      // Trial bundle (3-7 days before)
      const bundleDeadline = addDays(keyDates.trialDate, -3);
      deadlines.push({
        id: `${caseId}-trial-bundle`,
        caseId,
        title: 'Trial Bundle Due',
        description: 'Prepare and file trial bundle',
        dueDate: bundleDeadline,
        priority: 'critical',
        category: 'court',
        source: 'CPR PD 39A',
        status: bundleDeadline < now ? 'overdue' : 'pending',
        reminderDays: [7, 3, 1],
        createdAt: now,
        updatedAt: now
      });
    }

    return deadlines;
  }

  /**
   * Check for approaching deadlines and generate alerts
   */
  getApproachingDeadlines(deadlines: Deadline[], daysAhead = 7): Deadline[] {
    const cutoffDate = addDays(new Date(), daysAhead);
    
    return deadlines
      .filter(deadline => 
        deadline.status === 'pending' && 
        deadline.dueDate <= cutoffDate
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Generate calendar events for deadlines
   */
  generateCalendarEvents(deadlines: Deadline[]): Array<{
    title: string;
    start: Date;
    end: Date;
    description: string;
    priority: string;
    category: string;
  }> {
    return deadlines.map(deadline => ({
      title: deadline.title,
      start: startOfDay(deadline.dueDate),
      end: addDays(startOfDay(deadline.dueDate), 1),
      description: `${deadline.description}\n\nSource: ${deadline.source}\nCase: ${deadline.caseId}`,
      priority: deadline.priority,
      category: deadline.category
    }));
  }

  /**
   * AI-powered deadline analysis and suggestions
   */
  async analyzeCaseForDeadlines(caseId: string, caseDocuments: string[]): Promise<{
    identifiedDates: Array<{ date: Date; event: string; confidence: number }>;
    suggestedDeadlines: Deadline[];
    riskAssessment: string;
  }> {
    try {
      // Combine all case documents
      const combinedText = caseDocuments.join('\n\n---\n\n');
      
      // Use AI to identify key dates and events
      const dateAnalysis = await aiService.generateDraft(
        `Analyze this legal case and identify all important dates and events that could trigger deadlines. 
         Look for: cause of action dates, service dates, court orders, limitation periods, statutory deadlines.
         Format as JSON with date, event description, and confidence level (0-1).
         
         Case documents: ${combinedText.substring(0, 6000)}`,
        'You are a UK legal deadline calculator. Focus on CPR rules and statutory limitation periods.'
      );

      // Parse AI response and generate deadline suggestions
      let identifiedDates: Array<{ date: Date; event: string; confidence: number }> = [];
      let suggestedDeadlines: Deadline[] = [];
      
      try {
        const parsed = JSON.parse(dateAnalysis);
        identifiedDates = parsed.dates || [];
        
        // Generate deadlines based on identified dates
        for (const dateInfo of identifiedDates) {
          if (dateInfo.confidence > 0.7) {
            // High confidence dates - generate specific deadlines
            const eventDate = new Date(dateInfo.date);
            
            if (dateInfo.event.toLowerCase().includes('service')) {
              const caseDeadlines = await this.generateCaseDeadlines(caseId, 'litigation', {
                serviceDate: eventDate
              });
              suggestedDeadlines.push(...caseDeadlines);
            }
            
            if (dateInfo.event.toLowerCase().includes('cause of action') || 
                dateInfo.event.toLowerCase().includes('incident')) {
              const limitationDeadlines = await this.generateCaseDeadlines(caseId, 'personal_injury', {
                causeOfAction: eventDate
              });
              suggestedDeadlines.push(...limitationDeadlines);
            }
          }
        }
      } catch (error) {
        console.log('Could not parse AI date analysis, using fallback approach');
        // Fallback: create generic deadlines
      }

      // Generate risk assessment
      const riskAssessment = await aiService.generateDraft(
        `Based on the identified dates and deadlines for this case, provide a risk assessment. 
         Highlight any critical deadlines that may be missed, limitation period concerns, 
         and recommended immediate actions.
         
         Identified dates: ${JSON.stringify(identifiedDates)}`,
        'You are a UK legal risk analyst specializing in deadline management.'
      );

      return {
        identifiedDates,
        suggestedDeadlines: suggestedDeadlines.slice(0, 10), // Limit to top 10
        riskAssessment
      };
      
    } catch (error) {
      console.error('AI deadline analysis failed:', error);
      return {
        identifiedDates: [],
        suggestedDeadlines: [],
        riskAssessment: 'Unable to perform automated deadline analysis. Please manually review case documents for key dates.'
      };
    }
  }

  /**
   * Get all available court deadline rules
   */
  getAvailableCourtRules(): CourtDeadlineRule[] {
    return [...this.courtDeadlines];
  }

  /**
   * Get all limitation periods
   */
  getAvailableLimitationPeriods(): LimitationPeriod[] {
    return [...this.limitationPeriods];
  }

  /**
   * Calculate custom deadline with business day exclusions
   */
  calculateCustomDeadline(
    startDate: Date,
    days: number,
    excludeWeekends = true,
    excludePublicHolidays = true
  ): Date {
    if (excludeWeekends && excludePublicHolidays) {
      return this.calculateBusinessDay(startDate, days);
    } else if (excludeWeekends) {
      let currentDate = startOfDay(startDate);
      let daysAdded = 0;

      while (daysAdded < days) {
        currentDate = addDays(currentDate, 1);
        if (!isWeekend(currentDate)) {
          daysAdded++;
        }
      }
      return currentDate;
    } else {
      return addDays(startDate, days);
    }
  }
}

// Create singleton instance
export const deadlineCalculatorService = new DeadlineCalculatorService();