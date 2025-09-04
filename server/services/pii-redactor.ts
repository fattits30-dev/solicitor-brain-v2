import * as crypto from 'crypto';

/**
 * PII Redaction Service for GDPR Compliance
 * Comprehensive redaction system for Solicitor Brain v2
 */

export enum RedactionLevel {
  NONE = 'NONE', // No redaction (admin only)
  PARTIAL = 'PARTIAL', // Show partial info (e.g., "John D***")
  FULL = 'FULL', // Replace with [REDACTED]
  HASH = 'HASH', // Replace with consistent hash
}

export interface RedactionRule {
  id: string;
  name: string;
  pattern: RegExp;
  category: 'PII' | 'FINANCIAL' | 'LEGAL' | 'CONTACT' | 'IDENTIFIER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  replacement: {
    [RedactionLevel.FULL]: string;
    [RedactionLevel.PARTIAL]: (match: string) => string;
    [RedactionLevel.HASH]: (match: string) => string;
    [RedactionLevel.NONE]: (match: string) => string;
  };
}

export interface RedactionConfig {
  defaultLevel: RedactionLevel;
  roleBasedLevels: Record<string, RedactionLevel>;
  exemptedFields: string[];
  environmentOverrides: Record<string, RedactionLevel>;
  logRedactions: boolean;
  preserveFormat: boolean;
}

export interface RedactionResult {
  originalText: string;
  redactedText: string;
  redactionsApplied: Array<{
    ruleId: string;
    category: string;
    severity: string;
    matchCount: number;
    positions: Array<{ start: number; end: number; original: string; redacted: string }>;
  }>;
  level: RedactionLevel;
  timestamp: string;
}

class PIIRedactionService {
  private readonly rules: RedactionRule[] = [];
  private readonly config: RedactionConfig;
  private readonly hashSalt: string;

  constructor(config?: Partial<RedactionConfig>) {
    this.config = {
      defaultLevel: RedactionLevel.FULL,
      roleBasedLevels: {
        admin: RedactionLevel.NONE,
        senior_solicitor: RedactionLevel.PARTIAL,
        solicitor: RedactionLevel.PARTIAL,
        paralegal: RedactionLevel.FULL,
        support: RedactionLevel.FULL,
      },
      exemptedFields: [],
      environmentOverrides: {
        development: RedactionLevel.PARTIAL,
        staging: RedactionLevel.FULL,
        production: RedactionLevel.FULL,
      },
      logRedactions: true,
      preserveFormat: true,
      ...config,
    };

    this.hashSalt = process.env.PII_REDACTION_SALT || 'solicitor-brain-v2-redaction';
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // UK Names - First and Last names
    this.addRule({
      id: 'uk-names',
      name: 'UK Names',
      pattern: /\b[A-Z][a-z]{1,12}\s+[A-Z][a-z]{1,12}(?:\s+[A-Z][a-z]{1,12})?\b/g,
      category: 'PII',
      severity: 'HIGH',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[NAME_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => {
          console.log('PARTIAL REDACTION CALLED for match:', match);
          // Check if this is likely a name by excluding common non-name patterns
          const lowerMatch = match.toLowerCase();
          const nonNameIndicators = [
            'contact',
            'office',
            'client',
            'case',
            'file',
            'report',
            'document',
            'email',
            'phone',
            'address',
            'postcode',
            'sort',
            'account',
            'card',
            'reference',
            'ni',
            'jwt',
            'dob',
            'birth',
          ];

          if (nonNameIndicators.some((indicator) => lowerMatch.includes(indicator))) {
            // This might be a compound phrase, try to extract just the name part
            const words = match.split(' ');
            // Look for the last 2-3 words that might be the actual name
            if (words.length >= 3) {
              const potentialName = words.slice(-2).join(' ');
              console.log('Extracting name from compound phrase:', potentialName);
              const parts = potentialName.split(' ');
              const redactedName = parts.map((part) => part.charAt(0) + '***').join(' ');
              const result = match.replace(potentialName, redactedName);
              console.log('Compound phrase result:', result);
              return result;
            }
          }

          // Normal name redaction
          console.log('Normal name redaction for:', match);
          const parts = match.split(' ');
          const result = parts.map((part) => part.charAt(0) + '***').join(' ');
          console.log('Normal result:', result);
          return result;
        },
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'NAME'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // UK National Insurance Numbers
    this.addRule({
      id: 'uk-ni-number',
      name: 'UK National Insurance Numbers',
      pattern:
        /\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z][\s]?[0-9]{2}[\s]?[0-9]{2}[\s]?[0-9]{2}[\s]?[A-D]\b/gi,
      category: 'IDENTIFIER',
      severity: 'CRITICAL',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[NI_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => {
          const clean = match.replace(/\s/g, '');
          return clean.substring(0, 2) + 'XX XX XX X';
        },
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'NI'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // UK Postcodes
    this.addRule({
      id: 'uk-postcode',
      name: 'UK Postcodes',
      pattern: /\b[A-Z]{1,2}[0-9R][0-9A-Z]?[\s]?[0-9][A-Z]{2}\b/gi,
      category: 'PII',
      severity: 'MEDIUM',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[POSTCODE_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => {
          const clean = match.replace(/\s/g, '').toUpperCase();
          if (clean.length >= 6) {
            return clean.substring(0, 2) + 'X XXX';
          }
          return 'XXX XXX';
        },
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'POST'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // UK Phone Numbers - Comprehensive pattern
    this.addRule({
      id: 'uk-phone',
      name: 'UK Phone Numbers',
      pattern:
        /(\+44\s*\d{4}\s*\d{6}|\+44\s*\d{3}\s*\d{7}|\+44\s*\d{2}\s*\d{8}|\+44\s*\d{5}\s*\d{5}|07\d{3}\s*\d{6}|07\d{3}\d{6}|\(0\d{3}\)\s*\d{3}\s*\d{4}|\(0\d{4}\)\s*\d{3}\s*\d{3}|\(0\d{2}\)\s*\d{4}\s*\d{4}|0\d{3}\s*\d{3}\s*\d{4}|0\d{4}\s*\d{3}\s*\d{3}|0\d{2}\s*\d{4}\s*\d{4})/g,
      category: 'CONTACT',
      severity: 'HIGH',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[PHONE_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => {
          if (match.includes('+44')) {
            if (match.includes(' ')) {
              const parts = match.split(' ');
              if (parts.length >= 3) return '+44 XXXX XXXXXX';
              return '+44 XXXXX XXXXX';
            }
            return '+44 XXXX XXXXXX';
          }
          if (match.startsWith('07') || match.includes('(07')) return '07XXX XXXXXX';
          if (match.startsWith('020') || match.includes('(020')) return '020 XXXX XXXX';
          if (match.startsWith('0')) return '0XXXX XXXXXX';
          return 'XXXX XXXXXX';
        },
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'PHONE'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // Email Addresses
    this.addRule({
      id: 'email',
      name: 'Email Addresses',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      category: 'CONTACT',
      severity: 'HIGH',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[EMAIL_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => {
          const [local, domain] = match.split('@');
          if (local.length <= 2) return local + '***@' + domain;
          return local.substring(0, 2) + '***@' + domain;
        },
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'EMAIL'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // UK Addresses
    this.addRule({
      id: 'uk-address',
      name: 'UK Addresses',
      pattern:
        /\b\d+\s+[A-Za-z\s]+(?:Street|St|Road|Rd|Lane|Ln|Avenue|Ave|Drive|Dr|Close|Cl|Place|Pl|Way|Court|Ct|Gardens|Gdns|Crescent|Cres|Square|Sq|Terrace|Ter)\b/gi,
      category: 'PII',
      severity: 'MEDIUM',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[ADDRESS_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => {
          const parts = match.trim().split(/\s+/);
          if (parts.length >= 2) {
            const number = parts[0];
            const streetType = parts[parts.length - 1];
            return number + ' ' + streetType;
          }
          return 'XX ' + match.split(' ').pop();
        },
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'ADDR'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // Dates of Birth
    this.addRule({
      id: 'date-of-birth',
      name: 'Dates of Birth',
      pattern: /\b(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g,
      category: 'PII',
      severity: 'HIGH',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[DOB_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => {
          if (match.includes('/')) return 'XX/XX/XXXX';
          if (match.includes('-')) return 'XX-XX-XXXX';
          return 'XXXXXXXX';
        },
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'DOB'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // UK Bank Account Numbers
    this.addRule({
      id: 'uk-bank-account',
      name: 'UK Bank Account Numbers',
      pattern: /\b\d{8}\b/g,
      category: 'FINANCIAL',
      severity: 'CRITICAL',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[ACCOUNT_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => 'XXXX' + match.slice(-4),
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'BANK'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // UK Sort Codes - Support both hyphenated and spaced formats
    this.addRule({
      id: 'uk-sort-code',
      name: 'UK Sort Codes',
      pattern: /\b\d{2}[-]\d{2}[-]\d{2}\b/g, // Only match with hyphens to avoid conflicts with NI numbers
      category: 'FINANCIAL',
      severity: 'CRITICAL',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[SORT_REDACTED]',
        [RedactionLevel.PARTIAL]: (_match: string) => 'XX-XX-XX',
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'SORT'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // UK Sort Codes (spaced format)
    this.addRule({
      id: 'uk-sort-code-spaced',
      name: 'UK Sort Codes (Spaced)',
      pattern: /\b\d{2}\s\d{2}\s\d{2}\b/g,
      category: 'FINANCIAL',
      severity: 'CRITICAL',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[SORT_REDACTED]',
        [RedactionLevel.PARTIAL]: (_match: string) => 'XX XX XX',
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'SORT'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // Case Reference Numbers
    this.addRule({
      id: 'case-reference',
      name: 'Case Reference Numbers',
      pattern: /\b(CASE|REF|CR|SB)[-_\s]?[A-Z0-9]{4,12}\b/gi,
      category: 'LEGAL',
      severity: 'MEDIUM',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[CASE_REF_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => {
          const parts = match.split(/[-_\s]/);
          if (parts.length > 1) return parts[0] + '-XXXX';
          return match.substring(0, 4) + 'XXXX';
        },
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'CASE'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // JWT Tokens
    this.addRule({
      id: 'jwt-token',
      name: 'JWT Tokens',
      pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
      category: 'IDENTIFIER',
      severity: 'CRITICAL',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[JWT_REDACTED]',
        [RedactionLevel.PARTIAL]: (_match: string) => 'eyJ...[TRUNCATED]',
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'JWT'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // Credit Card Numbers
    this.addRule({
      id: 'credit-card',
      name: 'Credit Card Numbers',
      pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
      category: 'FINANCIAL',
      severity: 'CRITICAL',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[CARD_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => {
          const clean = match.replace(/[\s-]/g, '');
          return 'XXXX-XXXX-XXXX-' + clean.slice(-4);
        },
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'CARD'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });

    // Passport Numbers (UK)
    this.addRule({
      id: 'uk-passport',
      name: 'UK Passport Numbers',
      pattern: /\b[0-9]{9}\b/g,
      category: 'IDENTIFIER',
      severity: 'CRITICAL',
      enabled: true,
      replacement: {
        [RedactionLevel.FULL]: '[PASSPORT_REDACTED]',
        [RedactionLevel.PARTIAL]: (match: string) => 'XXXXX' + match.slice(-4),
        [RedactionLevel.HASH]: (match: string) => this.generateHash(match, 'PASS'),
        [RedactionLevel.NONE]: (match: string) => match,
      },
    });
  }

  private addRule(rule: RedactionRule): void {
    this.rules.push(rule);
  }

  private generateHash(input: string, prefix: string = 'HASH'): string {
    const hash = crypto
      .createHash('sha256')
      .update(input + this.hashSalt)
      .digest('hex')
      .substring(0, 8);
    return `[${prefix}_${hash.toUpperCase()}]`;
  }

  /**
   * Redact PII from text based on user role and configuration
   */
  public redact(
    text: string,
    userRole?: string,
    level?: RedactionLevel,
    exemptedFields: string[] = [],
  ): RedactionResult {
    if (!text || typeof text !== 'string') {
      return {
        originalText: text || '',
        redactedText: text || '',
        redactionsApplied: [],
        level: level || this.config.defaultLevel,
        timestamp: new Date().toISOString(),
      };
    }

    // Determine redaction level
    const effectiveLevel = this.determineRedactionLevel(userRole, level);
    console.log(
      'DEBUG: Effective level:',
      effectiveLevel,
      'Requested level:',
      level,
      'User role:',
      userRole,
    );

    // Skip redaction if NONE level
    if (effectiveLevel === RedactionLevel.NONE) {
      return {
        originalText: text,
        redactedText: text,
        redactionsApplied: [],
        level: effectiveLevel,
        timestamp: new Date().toISOString(),
      };
    }

    let redactedText = text;
    const redactionsApplied: RedactionResult['redactionsApplied'] = [];

    // Apply each enabled rule
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Skip if this rule category is exempted
      if (exemptedFields.includes(rule.category)) continue;

      const matches = Array.from(text.matchAll(rule.pattern));
      console.log(
        'DEBUG: Rule',
        rule.id,
        'matches:',
        matches.map((m) => m[0]),
      );
      if (matches.length === 0) continue;

      // Skip matches that overlap with already redacted content
      const validMatches = matches.filter((match) => {
        if (!match.index) {
          console.log('DEBUG: Match has no index:', match);
          return false;
        }
        // Check if this match overlaps with any existing redaction markers
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        const substring = redactedText.substring(matchStart, matchEnd);
        const hasBrackets = substring.includes('[') || substring.includes(']');
        console.log(
          'DEBUG: Match',
          match[0],
          'at',
          matchStart,
          '-',
          matchEnd,
          'substring:',
          substring,
          'has brackets:',
          hasBrackets,
        );
        return !hasBrackets;
      });

      console.log(
        'DEBUG: Valid matches for rule',
        rule.id,
        ':',
        validMatches.map((m) => m[0]),
      );

      if (validMatches.length === 0) continue;

      const positions: Array<{ start: number; end: number; original: string; redacted: string }> =
        [];

      // Apply replacements in reverse order to maintain indices
      const sortedMatches = validMatches.reverse();

      for (const match of sortedMatches) {
        if (!match.index) continue;

        const original = match[0];
        const replacement = rule.replacement[effectiveLevel];
        console.log(
          'DEBUG: Rule',
          rule.id,
          'replacement for level',
          effectiveLevel,
          ':',
          replacement,
          'type:',
          typeof replacement,
        );
        const redacted = typeof replacement === 'function' ? replacement(original) : replacement;
        console.log('DEBUG: Redacted result:', redacted);

        positions.unshift({
          start: match.index,
          end: match.index + original.length,
          original,
          redacted,
        });

        // Apply the redaction
        redactedText =
          redactedText.substring(0, match.index) +
          redacted +
          redactedText.substring(match.index + original.length);
      }

      if (positions.length > 0) {
        redactionsApplied.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          matchCount: validMatches.length,
          positions,
        });
      }
    }

    const result: RedactionResult = {
      originalText: text,
      redactedText,
      redactionsApplied,
      level: effectiveLevel,
      timestamp: new Date().toISOString(),
    };

    // Log redactions if enabled
    if (this.config.logRedactions && redactionsApplied.length > 0) {
      this.logRedaction(result);
    }

    return result;
  }

  /**
   * Redact PII from objects recursively
   */
  public redactObject(
    obj: any,
    userRole?: string,
    level?: RedactionLevel,
    exemptedFields: string[] = [],
  ): { redacted: any; summary: RedactionResult[] } {
    if (!obj || typeof obj !== 'object') {
      return { redacted: obj, summary: [] };
    }

    const redacted = Array.isArray(obj) ? [] : {};
    const summary: RedactionResult[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const result = this.redact(value, userRole, level, exemptedFields);
        if (Array.isArray(redacted)) {
          redacted.push(result.redactedText);
        } else {
          (redacted as any)[key] = result.redactedText;
        }
        if (result.redactionsApplied.length > 0) {
          summary.push(result);
        }
      } else if (typeof value === 'object' && value !== null) {
        const { redacted: nestedRedacted, summary: nestedSummary } = this.redactObject(
          value,
          userRole,
          level,
          exemptedFields,
        );
        if (Array.isArray(redacted)) {
          redacted.push(nestedRedacted);
        } else {
          (redacted as any)[key] = nestedRedacted;
        }
        summary.push(...nestedSummary);
      } else {
        if (Array.isArray(redacted)) {
          redacted.push(value);
        } else {
          (redacted as any)[key] = value;
        }
      }
    }

    return { redacted, summary };
  }

  private determineRedactionLevel(userRole?: string, level?: RedactionLevel): RedactionLevel {
    // Explicit level takes precedence
    if (level) return level;

    // Role-based level
    if (userRole && this.config.roleBasedLevels[userRole]) {
      return this.config.roleBasedLevels[userRole];
    }

    // Environment-based level
    const env = process.env.NODE_ENV || 'development';
    if (this.config.environmentOverrides[env]) {
      return this.config.environmentOverrides[env];
    }

    // Default level
    return this.config.defaultLevel;
  }

  private logRedaction(result: RedactionResult): void {
    console.log(`PII Redaction Applied:`, {
      level: result.level,
      redactionsCount: result.redactionsApplied.length,
      timestamp: result.timestamp,
    });
  }

  /**
   * Get all available rules
   */
  public getRules(): RedactionRule[] {
    return [...this.rules];
  }

  /**
   * Enable or disable a specific rule
   */
  public toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Add a custom redaction rule
   */
  public addCustomRule(rule: RedactionRule): boolean {
    // Check for duplicate IDs
    if (this.rules.some((r) => r.id === rule.id)) {
      return false;
    }
    this.addRule(rule);
    return true;
  }

  /**
   * Check if text contains PII without redacting
   */
  public containsPII(text: string): {
    hasPII: boolean;
    categories: string[];
    severities: string[];
    ruleMatches: Array<{ ruleId: string; category: string; severity: string; count: number }>;
  } {
    if (!text || typeof text !== 'string') {
      return { hasPII: false, categories: [], severities: [], ruleMatches: [] };
    }

    const categories = new Set<string>();
    const severities = new Set<string>();
    const ruleMatches: Array<{
      ruleId: string;
      category: string;
      severity: string;
      count: number;
    }> = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const matches = text.match(rule.pattern);
      if (matches) {
        categories.add(rule.category);
        severities.add(rule.severity);
        ruleMatches.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          count: matches.length,
        });
      }
    }

    return {
      hasPII: ruleMatches.length > 0,
      categories: Array.from(categories),
      severities: Array.from(severities),
      ruleMatches,
    };
  }

  /**
   * Get redaction statistics
   */
  public getStats(): {
    totalRules: number;
    enabledRules: number;
    disabledRules: number;
    rulesByCategory: Record<string, number>;
    rulesBySeverity: Record<string, number>;
  } {
    const enabledRules = this.rules.filter((r) => r.enabled).length;
    const disabledRules = this.rules.length - enabledRules;

    const rulesByCategory: Record<string, number> = {};
    const rulesBySeverity: Record<string, number> = {};

    for (const rule of this.rules) {
      rulesByCategory[rule.category] = (rulesByCategory[rule.category] || 0) + 1;
      rulesBySeverity[rule.severity] = (rulesBySeverity[rule.severity] || 0) + 1;
    }

    return {
      totalRules: this.rules.length,
      enabledRules,
      disabledRules,
      rulesByCategory,
      rulesBySeverity,
    };
  }

  /**
   * Enable or disable a specific rule
   */
  public setRuleStatus(ruleId: string, enabled: boolean): boolean {
    return this.toggleRule(ruleId, enabled);
  }

  /**
   * Create Express middleware for logging redacted requests
   */
  public createLoggingMiddleware(): (req: any, res: any, next: any) => void {
    return (req: any, res: any, next: any) => {
      if (req.body && typeof req.body === 'object') {
        const { redacted } = this.redactObject(req.body);
        console.log('Request body redacted for logging:', redacted);
      }
      next();
    };
  }

  /**
   * Create Express middleware for redacting error responses
   */
  public createErrorMiddleware(): (err: any, req: any, res: any, next: any) => void {
    return (err: any, req: any, res: any, next: any) => {
      if (err.message) {
        const result = this.redact(err.message);
        err.message = result.redactedText;
      }
      next(err);
    };
  }
}

export const piiRedactor = new PIIRedactionService();
export default PIIRedactionService;
