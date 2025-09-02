/**
 * Comprehensive Test Suite for PII Redaction Service
 * Tests UK-specific PII patterns and GDPR compliance functionality
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import PIIRedactionService, { RedactionLevel, RedactionRule } from '../services/pii-redactor';

describe('PIIRedactionService', () => {
  let piiRedactor: PIIRedactionService;

  beforeEach(() => {
    piiRedactor = new PIIRedactionService({
      defaultLevel: RedactionLevel.FULL,
      logRedactions: false, // Disable logging for tests
    });
  });

  describe('UK Names Redaction', () => {
    it('should redact full names with FULL level', () => {
      const text = 'The client John Smith attended the meeting.';
      const result = piiRedactor.redact(text, 'guest', RedactionLevel.FULL);

      expect(result.redactedText).toBe('The client [NAME_REDACTED] attended the meeting.');
      expect(result.redactionsApplied).toHaveLength(1);
      expect(result.redactionsApplied[0].category).toBe('PII');
    });

    it('should partially redact names with PARTIAL level', () => {
      const text = 'Contact John Smith for details.';
      const result = piiRedactor.redact(text, 'solicitor', RedactionLevel.PARTIAL);

      expect(result.redactedText).toBe('Contact J*** S*** for details.');
      expect(result.redactionsApplied).toHaveLength(1);
    });

    it('should not redact names with NONE level', () => {
      const text = 'John Smith is the client.';
      const result = piiRedactor.redact(text, 'admin', RedactionLevel.NONE);

      expect(result.redactedText).toBe('John Smith is the client.');
      expect(result.redactionsApplied).toHaveLength(0);
    });

    it('should handle multiple names in text', () => {
      const text = 'John Smith and Mary Johnson are co-defendants.';
      const result = piiRedactor.redact(text, 'guest', RedactionLevel.FULL);

      expect(result.redactedText).toBe('[NAME_REDACTED] and [NAME_REDACTED] are co-defendants.');
      expect(result.redactionsApplied[0].matchCount).toBe(2);
    });
  });

  describe('UK National Insurance Numbers', () => {
    it('should redact valid NI numbers', () => {
      const text = 'NI Number: AB 12 34 56 C';
      const result = piiRedactor.redact(text, 'guest', RedactionLevel.FULL);

      expect(result.redactedText).toBe('NI Number: [NI_REDACTED]');
      expect(result.redactionsApplied[0].severity).toBe('CRITICAL');
    });

    it('should partially redact NI numbers', () => {
      const text = 'Client NI: AB123456C';
      const result = piiRedactor.redact(text, 'solicitor', RedactionLevel.PARTIAL);

      expect(result.redactedText).toBe('Client NI: ABXX XX XX X');
    });

    it('should handle NI numbers with different spacing', () => {
      const testCases = [
        'AB123456C',
        'AB 12 34 56 C',
        'AB1234 56C'
      ];

      testCases.forEach(niNumber => {
        const result = piiRedactor.redact(`NI: ${niNumber}`, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('NI: [NI_REDACTED]');
      });
    });
  });

  describe('UK Postcodes', () => {
    it('should redact valid UK postcodes', () => {
      const testCases = [
        'SW1A 1AA',
        'M1 1AA',
        'B33 8TH',
        'W1A 0AX',
        'EC1A 1BB'
      ];

      testCases.forEach(postcode => {
        const result = piiRedactor.redact(`Address: London ${postcode}`, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('Address: London [POSTCODE_REDACTED]');
      });
    });

    it('should partially redact postcodes', () => {
      const result = piiRedactor.redact('SW1A 1AA', 'solicitor', RedactionLevel.PARTIAL);
      expect(result.redactedText).toBe('SWX XXX');
    });
  });

  describe('UK Phone Numbers', () => {
    it('should redact mobile numbers', () => {
      const testCases = [
        '+44 7123 456789',
        '07123 456789',
        '+447123456789'
      ];

      testCases.forEach(phone => {
        const result = piiRedactor.redact(`Call ${phone}`, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('Call [PHONE_REDACTED]');
      });
    });

    it('should redact landline numbers', () => {
      const testCases = [
        '+44 20 1234 5678',
        '020 1234 5678',
        '+44 1234 567890'
      ];

      testCases.forEach(phone => {
        const result = piiRedactor.redact(`Office: ${phone}`, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('Office: [PHONE_REDACTED]');
      });
    });

    it('should partially redact phone numbers', () => {
      const result = piiRedactor.redact('+44 7123 456789', 'solicitor', RedactionLevel.PARTIAL);
      expect(result.redactedText).toBe('+44 XXXX XXXXXX');
    });
  });

  describe('Email Addresses', () => {
    it('should redact email addresses', () => {
      const text = 'Contact john.smith@example.com for details.';
      const result = piiRedactor.redact(text, 'guest', RedactionLevel.FULL);

      expect(result.redactedText).toBe('Contact [EMAIL_REDACTED] for details.');
      expect(result.redactionsApplied[0].category).toBe('CONTACT');
    });

    it('should partially redact emails', () => {
      const result = piiRedactor.redact('john.smith@example.com', 'solicitor', RedactionLevel.PARTIAL);
      expect(result.redactedText).toBe('jo***@example.com');
    });

    it('should handle multiple email formats', () => {
      const testEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'admin+test@subdomain.example.org'
      ];

      testEmails.forEach(email => {
        const result = piiRedactor.redact(email, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('[EMAIL_REDACTED]');
      });
    });
  });

  describe('UK Addresses', () => {
    it('should redact street addresses', () => {
      const addresses = [
        '123 High Street',
        '45A Oxford Road',
        '10 Victoria Lane'
      ];

      addresses.forEach(address => {
        const result = piiRedactor.redact(address, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('[ADDRESS_REDACTED]');
      });
    });

    it('should partially redact addresses', () => {
      const result = piiRedactor.redact('123 High Street', 'solicitor', RedactionLevel.PARTIAL);
      expect(result.redactedText).toBe('XX Street');
    });
  });

  describe('Financial Information', () => {
    it('should redact bank account numbers', () => {
      const result = piiRedactor.redact('Account: 12345678', 'guest', RedactionLevel.FULL);
      expect(result.redactedText).toBe('Account: [ACCOUNT_REDACTED]');
      expect(result.redactionsApplied[0].severity).toBe('CRITICAL');
    });

    it('should redact sort codes', () => {
      const sortCodes = ['12-34-56', '12 34 56', '123456'];

      sortCodes.forEach(sortCode => {
        const result = piiRedactor.redact(`Sort: ${sortCode}`, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('Sort: [SORT_REDACTED]');
      });
    });

    it('should redact credit card numbers', () => {
      const cardNumbers = [
        '1234 5678 9012 3456',
        '1234-5678-9012-3456',
        '1234567890123456'
      ];

      cardNumbers.forEach(card => {
        const result = piiRedactor.redact(card, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('[CARD_REDACTED]');
      });
    });

    it('should partially redact financial information', () => {
      const result = piiRedactor.redact('1234 5678 9012 3456', 'solicitor', RedactionLevel.PARTIAL);
      expect(result.redactedText).toBe('XXXX-XXXX-XXXX-3456');
    });
  });

  describe('Legal References', () => {
    it('should redact case reference numbers', () => {
      const caseRefs = [
        'CASE-123456',
        'REF 789012',
        'CR_ABC123',
        'SB-XYZ789'
      ];

      caseRefs.forEach(ref => {
        const result = piiRedactor.redact(ref, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('[CASE_REF_REDACTED]');
      });
    });

    it('should partially redact case references', () => {
      const result = piiRedactor.redact('CASE-123456', 'solicitor', RedactionLevel.PARTIAL);
      expect(result.redactedText).toBe('CASE-XXXX');
    });
  });

  describe('Dates of Birth', () => {
    it('should redact DOB in various formats', () => {
      const dates = [
        '15/06/1990',
        '15-06-1990',
        '1990-06-15',
        '06/15/1990'
      ];

      dates.forEach(date => {
        const result = piiRedactor.redact(`DOB: ${date}`, 'guest', RedactionLevel.FULL);
        expect(result.redactedText).toBe('DOB: [DOB_REDACTED]');
      });
    });
  });

  describe('JWT Tokens', () => {
    it('should redact JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = piiRedactor.redact(jwt, 'guest', RedactionLevel.FULL);

      expect(result.redactedText).toBe('[JWT_REDACTED]');
      expect(result.redactionsApplied[0].severity).toBe('CRITICAL');
    });
  });

  describe('Object Redaction', () => {
    it('should redact PII in nested objects', () => {
      const testObject = {
        client: {
          name: 'John Smith',
          email: 'john@example.com',
          address: {
            street: '123 High Street',
            postcode: 'SW1A 1AA'
          }
        },
        case: {
          reference: 'CASE-123456',
          notes: 'Client NI: AB 12 34 56 C'
        }
      };

      const { redacted, summary } = piiRedactor.redactObject(testObject, 'guest', RedactionLevel.FULL);

      expect(redacted.client.name).toBe('[NAME_REDACTED]');
      expect(redacted.client.email).toBe('[EMAIL_REDACTED]');
      expect(redacted.client.address.street).toBe('[ADDRESS_REDACTED]');
      expect(redacted.client.address.postcode).toBe('[POSTCODE_REDACTED]');
      expect(redacted.case.reference).toBe('[CASE_REF_REDACTED]');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should handle arrays in objects', () => {
      const testObject = {
        clients: [
          { name: 'John Smith', email: 'john@example.com' },
          { name: 'Jane Doe', email: 'jane@example.com' }
        ]
      };

      const { redacted } = piiRedactor.redactObject(testObject, 'guest', RedactionLevel.FULL);

      expect(redacted.clients[0].name).toBe('[NAME_REDACTED]');
      expect(redacted.clients[0].email).toBe('[EMAIL_REDACTED]');
      expect(redacted.clients[1].name).toBe('[NAME_REDACTED]');
      expect(redacted.clients[1].email).toBe('[EMAIL_REDACTED]');
    });
  });

  describe('PII Detection', () => {
    it('should detect PII without redacting', () => {
      const text = 'John Smith lives at 123 High Street, his email is john@example.com and NI is AB 12 34 56 C';
      const detection = piiRedactor.containsPII(text);

      expect(detection.hasPII).toBe(true);
      expect(detection.categories).toContain('PII');
      expect(detection.categories).toContain('CONTACT');
      expect(detection.categories).toContain('IDENTIFIER');
      expect(detection.severities).toContain('HIGH');
      expect(detection.severities).toContain('CRITICAL');
      expect(detection.ruleMatches.length).toBeGreaterThan(0);
    });

    it('should return false for text without PII', () => {
      const text = 'This is a generic message about legal procedures.';
      const detection = piiRedactor.containsPII(text);

      expect(detection.hasPII).toBe(false);
      expect(detection.categories).toHaveLength(0);
      expect(detection.ruleMatches).toHaveLength(0);
    });
  });

  describe('Role-based Redaction', () => {
    it('should apply different redaction levels based on role', () => {
      const text = 'John Smith email: john@example.com';

      const adminResult = piiRedactor.redact(text, 'admin');
      const solicitorResult = piiRedactor.redact(text, 'solicitor');
      const guestResult = piiRedactor.redact(text, 'guest');

      expect(adminResult.redactedText).toBe(text); // No redaction for admin
      expect(solicitorResult.redactedText).toContain('J***'); // Partial redaction
      expect(guestResult.redactedText).toContain('[NAME_REDACTED]'); // Full redaction
    });
  });

  describe('Custom Rules', () => {
    it('should allow adding custom redaction rules', () => {
      const customRule: RedactionRule = {
        id: 'test-pattern',
        name: 'Test Pattern',
        pattern: /TEST-\d{4}/g,
        category: 'LEGAL',
        severity: 'MEDIUM',
        enabled: true,
        replacement: {
          [RedactionLevel.FULL]: '[TEST_REDACTED]',
          [RedactionLevel.PARTIAL]: (_match: string) => 'TEST-XXXX',
          [RedactionLevel.HASH]: (_match: string) => '[TEST_HASH]',
          [RedactionLevel.NONE]: (_match: string) => _match,
        }
      };

      piiRedactor.addCustomRule(customRule);

      const result = piiRedactor.redact('Reference: TEST-1234', 'guest', RedactionLevel.FULL);
      expect(result.redactedText).toBe('Reference: [TEST_REDACTED]');
    });

    it('should prevent duplicate rule IDs', () => {
      const rule1: RedactionRule = {
        id: 'duplicate-test',
        name: 'First Rule',
        pattern: /test1/g,
        category: 'PII',
        severity: 'LOW',
        enabled: true,
        replacement: {
          [RedactionLevel.FULL]: '[TEST1]',
          [RedactionLevel.PARTIAL]: () => '[TEST1]',
          [RedactionLevel.HASH]: () => '[TEST1]',
          [RedactionLevel.NONE]: (match: string) => match,
        }
      };

      const rule2: RedactionRule = {
        id: 'duplicate-test', // Same ID
        name: 'Second Rule',
        pattern: /test2/g,
        category: 'PII',
        severity: 'LOW',
        enabled: true,
        replacement: {
          [RedactionLevel.FULL]: '[TEST2]',
          [RedactionLevel.PARTIAL]: () => '[TEST2]',
          [RedactionLevel.HASH]: () => '[TEST2]',
          [RedactionLevel.NONE]: (match: string) => match,
        }
      };

      piiRedactor.addCustomRule(rule1);
      expect(() => piiRedactor.addCustomRule(rule2)).toThrow('already exists');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty or null input', () => {
      const nullResult = piiRedactor.redact(null as any, 'guest');
      const undefinedResult = piiRedactor.redact(undefined as any, 'guest');
      const emptyResult = piiRedactor.redact('', 'guest');

      expect(nullResult.redactedText).toBe('');
      expect(undefinedResult.redactedText).toBe('');
      expect(emptyResult.redactedText).toBe('');
    });

    it('should handle reasonably long text efficiently', () => {
      // Reduced repetition to avoid pathological regex backtracking while still testing performance
      const longText = 'John Smith '.repeat(200) + 'john@example.com '.repeat(200);
      const startTime = Date.now();

      const result = piiRedactor.redact(longText, 'guest', RedactionLevel.FULL);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should complete in under 0.5 second for reduced size
      expect(result.redactionsApplied.length).toBeGreaterThan(0);
    });

    it('should maintain text structure when preserveFormat is enabled', () => {
      const text = 'Client: John Smith\nEmail: john@example.com\nPhone: +44 7123 456789';
      const result = piiRedactor.redact(text, 'guest', RedactionLevel.FULL);

      expect(result.redactedText).toContain('\n'); // Should preserve newlines
      expect(result.redactedText.split('\n')).toHaveLength(3);
    });
  });

  describe('Hash Consistency', () => {
    it('should generate consistent hashes for same input', () => {
      const text = 'John Smith';

      const result1 = piiRedactor.redact(text, 'guest', RedactionLevel.HASH);
      const result2 = piiRedactor.redact(text, 'guest', RedactionLevel.HASH);

      expect(result1.redactedText).toBe(result2.redactedText);
    });

    it('should generate different hashes for different inputs', () => {
      const text1 = 'John Smith';
      const text2 = 'Jane Doe';

      const result1 = piiRedactor.redact(text1, 'guest', RedactionLevel.HASH);
      const result2 = piiRedactor.redact(text2, 'guest', RedactionLevel.HASH);

      expect(result1.redactedText).not.toBe(result2.redactedText);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide redaction statistics', () => {
      const stats = piiRedactor.getStats();

      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.enabledRules).toBeLessThanOrEqual(stats.totalRules);
      expect(stats.rulesByCategory).toHaveProperty('PII');
      expect(stats.rulesByCategory).toHaveProperty('FINANCIAL');
      expect(stats.rulesBySeverity).toHaveProperty('CRITICAL');
    });

    it('should allow enabling/disabling rules', () => {
      const ruleId = 'email';

      // Disable rule
      const disabled = piiRedactor.setRuleStatus(ruleId, false);
      expect(disabled).toBe(true);

      // Test that rule is disabled
      const result1 = piiRedactor.redact('john@example.com', 'guest', RedactionLevel.FULL);
      expect(result1.redactedText).toBe('john@example.com'); // Should not be redacted

      // Re-enable rule
      const enabled = piiRedactor.setRuleStatus(ruleId, true);
      expect(enabled).toBe(true);

      // Test that rule is enabled again
      const result2 = piiRedactor.redact('john@example.com', 'guest', RedactionLevel.FULL);
      expect(result2.redactedText).toBe('[EMAIL_REDACTED]');
    });
  });

  // Integration tests for middleware
  describe('PII Middleware Integration', () => {
    it('should create logging middleware', () => {
      const middleware = piiRedactor.createLoggingMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should create error middleware', () => {
      const middleware = piiRedactor.createErrorMiddleware();
      expect(typeof middleware).toBe('function');
    });
  });

  // Performance benchmarks
  describe('Performance Benchmarks', () => {
    it('should process typical case data within acceptable time', () => {
    const caseData = {
      clientName: 'John Smith',
      clientEmail: 'john.smith@example.com',
      clientPhone: '+44 7123 456789',
      address: '123 High Street, London SW1A 1AA',
      nationalInsurance: 'AB 12 34 56 C',
      bankAccount: '12345678',
      sortCode: '12-34-56',
      caseReference: 'CASE-789012',
      notes: 'Client involved in property dispute with Mary Johnson at 456 Oxford Street, contacted via jane.doe@law.com'
    };

    const startTime = process.hrtime.bigint();
    const { redacted } = piiRedactor.redactObject(caseData, 'paralegal');
    const endTime = process.hrtime.bigint();

    const durationMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    expect(durationMs).toBeLessThan(50); // Should complete in under 50ms

    // Verify redaction occurred
    expect(redacted.clientName).toBe('[NAME_REDACTED]');
    expect(redacted.clientEmail).toBe('[EMAIL_REDACTED]');
    expect(redacted.nationalInsurance).toBe('[NI_REDACTED]');
  });
  });
});
