/**
 * Enhanced PII Redaction Service
 * Implements comprehensive PII detection and redaction for UK legal documents
 */

class PIIRedactionService {
  constructor() {
    // UK-specific PII patterns
    this.patterns = {
      // Personal Identifiers
      nino: {
        regex: /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-Z]\b/gi,
        replacement: '[NINO_REDACTED]',
        description: 'UK National Insurance Number'
      },
      passport: {
        regex: /\b[0-9]{9}\b/g,
        replacement: '[PASSPORT_REDACTED]',
        description: 'UK Passport Number'
      },
      drivingLicense: {
        regex: /\b[A-Z]{5}\d{6}[A-Z0-9]{6}\b/gi,
        replacement: '[DRIVING_LICENSE_REDACTED]',
        description: 'UK Driving License'
      },
      nhsNumber: {
        regex: /\b\d{3}\s?\d{3}\s?\d{4}\b/g,
        replacement: '[NHS_NUMBER_REDACTED]',
        description: 'NHS Number'
      },

      // Financial Information
      ukBankAccount: {
        regex: /\b\d{2}-\d{2}-\d{2}\s?\d{8}\b/g,
        replacement: '[BANK_ACCOUNT_REDACTED]',
        description: 'UK Bank Account'
      },
      sortCode: {
        regex: /\b\d{2}-\d{2}-\d{2}\b/g,
        replacement: '[SORT_CODE_REDACTED]',
        description: 'UK Sort Code'
      },
      creditCard: {
        regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
        replacement: '[CREDIT_CARD_REDACTED]',
        description: 'Credit Card Number'
      },
      iban: {
        regex: /\b[A-Z]{2}\d{2}\s?[A-Z0-9]{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/gi,
        replacement: '[IBAN_REDACTED]',
        description: 'International Bank Account Number'
      },

      // Contact Information
      email: {
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: '[EMAIL_REDACTED]',
        description: 'Email Address'
      },
      ukPhone: {
        regex: /\b(?:0|\+44\s?)[1-9]\d{1,4}\s?\d{3,4}\s?\d{3,4}\b/g,
        replacement: '[PHONE_REDACTED]',
        description: 'UK Phone Number'
      },
      ukMobile: {
        regex: /\b(?:07\d{3}|\+447\d{3})\s?\d{6}\b/g,
        replacement: '[MOBILE_REDACTED]',
        description: 'UK Mobile Number'
      },

      // Address Components
      ukPostcode: {
        regex: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi,
        replacement: '[POSTCODE_REDACTED]',
        description: 'UK Postcode'
      },

      // Legal Identifiers
      caseNumber: {
        regex: /\b(?:ET|EAT|CA|SC|HC|DC|CC)\/\d{4}\/\d{4,6}\b/gi,
        replacement: '[CASE_NUMBER_REDACTED]',
        description: 'UK Legal Case Number',
        excludeFromDefault: true // Only redact when explicitly requested
      },
      solicitorNumber: {
        regex: /\bSRA\s?ID:\s?\d{6}\b/gi,
        replacement: '[SRA_ID_REDACTED]',
        description: 'Solicitor Regulation Authority ID'
      },

      // Dates of Birth (various formats)
      dateOfBirth: {
        regex: /\b(?:DOB|Date of Birth|Born)[\s:]*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/gi,
        replacement: '[DOB_REDACTED]',
        description: 'Date of Birth'
      },

      // IP Addresses
      ipAddress: {
        regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replacement: '[IP_ADDRESS_REDACTED]',
        description: 'IP Address'
      }
    };

    // Named Entity Recognition patterns for UK context
    this.namedEntities = {
      personNames: {
        // Common UK name patterns
        prefixes: ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Sir', 'Lady', 'Lord'],
        suffixes: ['QC', 'KC', 'JP', 'OBE', 'MBE', 'CBE', 'PhD', 'MD', 'LLB', 'LLM']
      },
      organizations: {
        // UK legal and government organizations
        keywords: ['Court', 'Tribunal', 'Council', 'Authority', 'Department', 'Ministry',
                  'Police', 'NHS', 'HMRC', 'DWP', 'Ltd', 'Limited', 'PLC', 'LLP']
      },
      locations: {
        // UK-specific location indicators
        keywords: ['Street', 'Road', 'Avenue', 'Lane', 'Close', 'Court', 'Gardens',
                  'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh']
      }
    };

    // Whitelist of terms that should never be redacted
    this.whitelist = [
      'Employment Tribunal',
      'County Court',
      'High Court',
      'Supreme Court',
      'Court of Appeal',
      'Magistrates Court',
      'Crown Court',
      'First-tier Tribunal',
      'Upper Tribunal'
    ];
  }

  /**
   * Main redaction method
   * @param {string} text - Text to redact
   * @param {object} options - Redaction options
   * @returns {object} Redacted text and metadata
   */
  redact(text, options = {}) {
    const {
      level = 'standard', // 'minimal', 'standard', 'maximum'
      excludePatterns = [],
      includePatterns = [],
      preserveStructure = true,
      generateReport = true
    } = options;

    let redactedText = text;
    const redactionLog = [];
    const statistics = {
      originalLength: text.length,
      redactedItems: 0,
      patternCounts: {}
    };

    // Determine which patterns to apply based on level
    const patternsToApply = this.getPatternsForLevel(level, excludePatterns, includePatterns);

    // Apply pattern-based redaction
    patternsToApply.forEach(({ name, pattern }) => {
      const matches = redactedText.match(pattern.regex) || [];
      if (matches.length > 0) {
        statistics.patternCounts[name] = matches.length;
        statistics.redactedItems += matches.length;

        matches.forEach(match => {
          if (!this.isWhitelisted(match)) {
            redactionLog.push({
              type: name,
              original: match,
              replacement: pattern.replacement,
              position: redactedText.indexOf(match)
            });

            redactedText = redactedText.replace(
              new RegExp(this.escapeRegex(match), 'g'),
              pattern.replacement
            );
          }
        });
      }
    });

    // Apply NER-based redaction if at maximum level
    if (level === 'maximum') {
      const nerRedactions = this.applyNERRedaction(redactedText);
      redactedText = nerRedactions.text;
      redactionLog.push(...nerRedactions.log);
      statistics.redactedItems += nerRedactions.count;
    }

    // Generate redaction report if requested
    const report = generateReport ? this.generateRedactionReport(
      text,
      redactedText,
      redactionLog,
      statistics
    ) : null;

    return {
      redactedText,
      originalText: text,
      redactionLog,
      statistics,
      report,
      timestamp: new Date().toISOString(),
      level
    };
  }

  /**
   * Get patterns based on redaction level
   */
  getPatternsForLevel(level, excludePatterns, includePatterns) {
    let patterns = [];

    switch (level) {
      case 'minimal':
        // Only most sensitive identifiers
        patterns = ['nino', 'passport', 'creditCard', 'ukBankAccount'];
        break;
      
      case 'standard':
        // All personal and financial identifiers
        patterns = Object.keys(this.patterns).filter(p => 
          !this.patterns[p].excludeFromDefault
        );
        break;
      
      case 'maximum':
        // Everything including case numbers
        patterns = Object.keys(this.patterns);
        break;
    }

    // Apply exclusions and inclusions
    patterns = patterns.filter(p => !excludePatterns.includes(p));
    patterns = [...new Set([...patterns, ...includePatterns])];

    return patterns.map(name => ({
      name,
      pattern: this.patterns[name]
    }));
  }

  /**
   * Apply Named Entity Recognition based redaction
   */
  applyNERRedaction(text) {
    let redactedText = text;
    const log = [];
    let count = 0;

    // Detect and redact person names
    const namePattern = new RegExp(
      `\\b(${this.namedEntities.personNames.prefixes.join('|')})\\s+[A-Z][a-z]+\\s+[A-Z][a-z]+\\b`,
      'g'
    );
    
    const nameMatches = text.match(namePattern) || [];
    nameMatches.forEach(match => {
      if (!this.isWhitelisted(match)) {
        redactedText = redactedText.replace(match, '[NAME_REDACTED]');
        log.push({
          type: 'person_name',
          original: match,
          replacement: '[NAME_REDACTED]'
        });
        count++;
      }
    });

    // Detect and redact organization names (be careful not to redact courts)
    const orgPattern = new RegExp(
      `\\b[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*\\s+(?:${this.namedEntities.organizations.keywords.join('|')})\\b`,
      'g'
    );
    
    const orgMatches = text.match(orgPattern) || [];
    orgMatches.forEach(match => {
      if (!this.isWhitelisted(match)) {
        redactedText = redactedText.replace(match, '[ORGANIZATION_REDACTED]');
        log.push({
          type: 'organization',
          original: match,
          replacement: '[ORGANIZATION_REDACTED]'
        });
        count++;
      }
    });

    return { text: redactedText, log, count };
  }

  /**
   * Check if a term is whitelisted
   */
  isWhitelisted(term) {
    return this.whitelist.some(whitelistItem => 
      term.toLowerCase().includes(whitelistItem.toLowerCase())
    );
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate detailed redaction report
   */
  generateRedactionReport(originalText, redactedText, log, statistics) {
    return {
      summary: {
        originalLength: statistics.originalLength,
        redactedLength: redactedText.length,
        totalRedactions: statistics.redactedItems,
        redactionPercentage: ((statistics.redactedItems / originalText.split(/\s+/).length) * 100).toFixed(2) + '%'
      },
      byCategory: {
        personalIdentifiers: log.filter(l => ['nino', 'passport', 'nhsNumber'].includes(l.type)).length,
        financialData: log.filter(l => ['creditCard', 'ukBankAccount', 'sortCode'].includes(l.type)).length,
        contactInfo: log.filter(l => ['email', 'ukPhone', 'ukMobile'].includes(l.type)).length,
        locationData: log.filter(l => ['ukPostcode'].includes(l.type)).length,
        namedEntities: log.filter(l => ['person_name', 'organization'].includes(l.type)).length
      },
      patternBreakdown: statistics.patternCounts,
      recommendations: this.generateRecommendations(log, statistics)
    };
  }

  /**
   * Generate recommendations based on redaction results
   */
  generateRecommendations(log, statistics) {
    const recommendations = [];

    if (statistics.redactedItems === 0) {
      recommendations.push('No PII detected. Consider reviewing if document should contain personal information.');
    }

    if (statistics.redactedItems > 50) {
      recommendations.push('High volume of PII detected. Consider if this document should be handled with extra security measures.');
    }

    const hasFinancial = log.some(l => ['creditCard', 'ukBankAccount'].includes(l.type));
    if (hasFinancial) {
      recommendations.push('Financial information detected. Ensure PCI DSS compliance if storing.');
    }

    const hasNINO = log.some(l => l.type === 'nino');
    if (hasNINO) {
      recommendations.push('National Insurance Numbers detected. Special handling required under UK data protection laws.');
    }

    return recommendations;
  }

  /**
   * Reverse redaction for authorized users
   */
  reverseRedaction(redactedText, log, authorizationLevel = 'none') {
    if (authorizationLevel === 'none') {
      return redactedText;
    }

    let reversedText = redactedText;

    log.forEach(entry => {
      // Check if user is authorized to see this type of data
      if (this.isAuthorizedForType(entry.type, authorizationLevel)) {
        reversedText = reversedText.replace(entry.replacement, entry.original);
      }
    });

    return reversedText;
  }

  /**
   * Check authorization level for data type
   */
  isAuthorizedForType(type, authorizationLevel) {
    const authMatrix = {
      'admin': ['all'],
      'solicitor': ['nino', 'email', 'ukPhone', 'ukPostcode', 'caseNumber'],
      'paralegal': ['email', 'ukPhone', 'caseNumber'],
      'client': ['caseNumber']
    };

    const allowedTypes = authMatrix[authorizationLevel] || [];
    return allowedTypes.includes('all') || allowedTypes.includes(type);
  }

  /**
   * Validate redaction completeness
   */
  validateRedaction(text) {
    const issues = [];

    // Check for any remaining patterns that look like PII
    Object.entries(this.patterns).forEach(([name, pattern]) => {
      const matches = text.match(pattern.regex);
      if (matches && matches.length > 0) {
        // Check if they're properly redacted
        matches.forEach(match => {
          if (!match.includes('REDACTED')) {
            issues.push({
              type: name,
              value: match,
              severity: 'high',
              message: `Potential unredacted ${pattern.description} found`
            });
          }
        });
      }
    });

    return {
      isValid: issues.length === 0,
      issues,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new PIIRedactionService();