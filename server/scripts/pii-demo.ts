#!/usr/bin/env tsx
/**
 * PII Redaction System Demo and Testing Script
 *
 * This script demonstrates the complete PII redaction system implementation
 * and can be used to test the functionality before integration.
 *
 * Usage: npx tsx server/scripts/pii-demo.ts
 */

import { piiRedactor, RedactionLevel } from '../services/pii-redactor';
import { auditLogger } from '../utils/audit-logger';

console.log('🛡️  PII Redaction System Demo for Solicitor Brain v2');
console.log('='.repeat(60));

// Test data representing typical UK legal case information
const testData = {
  case: {
    id: 'CASE-789012',
    clientName: 'John Smith',
    clientEmail: 'john.smith@example.com',
    clientPhone: '+44 7123 456789',
    clientMobile: '07987 654321',
    address: {
      street: '123 High Street',
      city: 'London',
      postcode: 'SW1A 1AA',
    },
    personalInfo: {
      dateOfBirth: '15/06/1990',
      nationalInsurance: 'AB 12 34 56 C',
      passportNumber: '987654321',
    },
    financialInfo: {
      bankAccount: '12345678',
      sortCode: '12-34-56',
      creditCard: '1234 5678 9012 3456',
    },
    documents: [
      {
        title: 'Contract Review',
        content:
          'Client John Smith (NI: AB123456C) has requested review of property contract for 123 High Street, London SW1A 1AA. Contact details: john.smith@example.com, +44 7123 456789',
      },
      {
        title: 'Financial Statement',
        content: 'Bank details: Account 12345678, Sort Code 12-34-56, Card ending 3456',
      },
    ],
    notes:
      'Opposing party: Mary Johnson (mary.johnson@law.co.uk), representing property dispute case CR-456789. Scheduled court hearing at Royal Courts of Justice.',
  },
  metadata: {
    created: '2024-01-15T10:30:00Z',
    solicitor: 'Jane Legal',
    firm: 'Smith & Partners LLP',
  },
};

function printSection(title: string) {
  console.log('\n' + '='.repeat(40));
  console.log(`📋 ${title}`);
  console.log('='.repeat(40));
}

function printResult(level: string, result: any) {
  console.log(`\n🔒 ${level} Redaction:`);
  console.log(JSON.stringify(result, null, 2));
}

async function demonstratePIIRedaction() {
  printSection('1. Basic PII Detection');

  // Test PII detection without redaction
  const textSample =
    'John Smith lives at 123 High Street, London SW1A 1AA. Contact: john@example.com, +44 7123 456789, NI: AB 12 34 56 C';
  const piiDetection = piiRedactor.containsPII(textSample);

  console.log('Sample text:', textSample);
  console.log('\nPII Detection Results:');
  console.log('- Has PII:', piiDetection.hasPII);
  console.log('- Categories found:', piiDetection.categories.join(', '));
  console.log('- Severity levels:', piiDetection.severities.join(', '));
  console.log('- Rule matches:', piiDetection.ruleMatches.length);

  piiDetection.ruleMatches.forEach((match) => {
    console.log(
      `  • ${match.ruleId} (${match.category}/${match.severity}): ${match.matches} matches`,
    );
  });

  printSection('2. Role-Based Redaction Levels');

  const roles = ['admin', 'senior_solicitor', 'solicitor', 'paralegal', 'support'];

  for (const role of roles) {
    console.log(`\n👤 ${role.toUpperCase()} view:`);
    const { redacted, summary } = piiRedactor.redactObject(testData, role);

    console.log(`Client Name: ${redacted.case.clientName}`);
    console.log(`Client Email: ${redacted.case.clientEmail}`);
    console.log(`NI Number: ${redacted.case.personalInfo.nationalInsurance}`);
    console.log(`Bank Account: ${redacted.case.financialInfo.bankAccount}`);
    console.log(`Redactions Applied: ${summary.length}`);
  }

  printSection('3. Explicit Redaction Levels');

  const levels = [
    RedactionLevel.NONE,
    RedactionLevel.PARTIAL,
    RedactionLevel.FULL,
    RedactionLevel.HASH,
  ];

  for (const level of levels) {
    const { redacted } = piiRedactor.redactObject(testData.case.personalInfo, 'test', level);
    printResult(level, redacted);
  }

  printSection('4. Document Content Redaction');

  for (const doc of testData.case.documents) {
    console.log(`\n📄 Document: ${doc.title}`);
    console.log('Original:', doc.content);

    const result = piiRedactor.redact(doc.content, 'solicitor', RedactionLevel.PARTIAL);
    console.log('Redacted:', result.redactedText);
    console.log('Rules applied:', result.redactionsApplied.length);
  }

  printSection('5. Middleware Simulation');

  // Simulate API response redaction
  console.log('\n🌐 Simulating API Response Redaction:');

  const apiResponse = {
    success: true,
    data: testData.case,
    message: 'Case details retrieved successfully',
  };

  console.log('\nOriginal API Response (truncated):');
  console.log({
    ...apiResponse,
    data: { ...apiResponse.data, documents: '[TRUNCATED]' },
  });

  const { redacted: redactedResponse } = piiRedactor.redactObject(apiResponse, 'paralegal');

  console.log('\nRedacted API Response (PARALEGAL level):');
  console.log({
    ...redactedResponse,
    data: { ...redactedResponse.data, documents: '[TRUNCATED]' },
  });

  printSection('6. Performance Testing');

  // Performance test with large dataset
  const largeDataset = Array(100)
    .fill(testData)
    .map((item, index) => ({
      ...item,
      case: { ...item.case, id: `CASE-${String(index).padStart(6, '0')}` },
    }));

  console.log(`\n⚡ Testing performance with ${largeDataset.length} case records...`);

  const startTime = process.hrtime.bigint();
  const { redacted: redactedLarge, summary: largeSummary } = piiRedactor.redactObject(
    largeDataset,
    'solicitor',
  );
  const endTime = process.hrtime.bigint();

  const durationMs = Number(endTime - startTime) / 1000000;
  console.log(`Processing time: ${durationMs.toFixed(2)}ms`);
  console.log(`Records processed: ${redactedLarge.length}`);
  console.log(`Total redactions: ${largeSummary.length}`);
  console.log(`Average time per record: ${(durationMs / largeDataset.length).toFixed(3)}ms`);

  printSection('7. Custom Rule Demo');

  // Add a custom rule for court references
  piiRedactor.addCustomRule({
    id: 'court-reference',
    name: 'Court Reference Numbers',
    pattern: /\b[A-Z]{2}-\d{6}\b/g,
    category: 'LEGAL',
    severity: 'MEDIUM',
    enabled: true,
    replacement: {
      [RedactionLevel.FULL]: '[COURT_REF_REDACTED]',
      [RedactionLevel.PARTIAL]: (match: string) => match.substring(0, 2) + '-XXXXXX',
      [RedactionLevel.HASH]: (match: string) => piiRedactor['generateHash'](match, 'COURT'),
      [RedactionLevel.NONE]: (match: string) => match,
    },
  });

  const courtText = 'Court reference HC-123456 assigned to this case.';
  const courtResult = piiRedactor.redact(courtText, 'paralegal');

  console.log('\n⚖️  Custom court reference rule:');
  console.log('Original:', courtText);
  console.log('Redacted:', courtResult.redactedText);

  printSection('8. Export Warning Simulation');

  // Simulate export operation with PII detection
  const exportData = {
    cases: [testData.case],
    exportDate: new Date().toISOString(),
    requestedBy: 'user@law.com',
  };

  const exportPIICheck = piiRedactor.containsPII(JSON.stringify(exportData));

  console.log('\n📤 Export Data PII Analysis:');
  console.log('Contains PII:', exportPIICheck.hasPII);

  if (exportPIICheck.hasPII) {
    console.log('⚠️  WARNING: Export contains sensitive data!');
    console.log('Categories:', exportPIICheck.categories.join(', '));
    console.log('Recommendation: Review and redact before export');

    // Show what the export would look like with redaction
    const { redacted: safeExport } = piiRedactor.redactObject(
      exportData,
      'admin',
      RedactionLevel.PARTIAL,
    );
    console.log('\nSuggested redacted export format:');
    console.log(JSON.stringify(safeExport, null, 2).substring(0, 300) + '...');
  }

  printSection('9. System Statistics');

  const stats = piiRedactor.getStats();
  console.log('\n📊 Redaction System Statistics:');
  console.log('Total rules:', stats.totalRules);
  console.log('Enabled rules:', stats.enabledRules);
  console.log('\nRules by category:');
  Object.entries(stats.rulesByCategory).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });
  console.log('\nRules by severity:');
  Object.entries(stats.rulesBySeverity).forEach(([severity, count]) => {
    console.log(`  ${severity}: ${count}`);
  });

  printSection('10. Audit Log Integration');

  // Demonstrate audit logging with PII redaction
  console.log('\n📝 Audit logging with PII redaction:');
  console.log('(Check logs/audit/ directory for output)');

  auditLogger.logDataAccess('user123', 'cases/789012', 'READ', true);
  auditLogger.logError(new Error('Sample error with PII: john.smith@example.com'), 'user123', {
    caseId: 'CASE-789012',
    clientNI: 'AB 12 34 56 C',
  });

  console.log('\n✅ Audit logs written with PII redaction applied');
}

// Run the demonstration
async function main() {
  try {
    await demonstratePIIRedaction();

    printSection('Demo Complete');
    console.log('\n🎉 PII Redaction System demonstration completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('1. Review the generated files in server/services/ and server/middleware/');
    console.log('2. Run the test suite: npm test server/tests/pii-redactor.test.ts');
    console.log('3. Integrate middleware into your Express server');
    console.log('4. Configure environment variables for production');
    console.log('5. Review and adjust redaction rules as needed');

    console.log('\n🔐 Security reminders:');
    console.log('- Always test redaction rules with real data in development');
    console.log('- Regularly audit logs for any PII leakage');
    console.log('- Keep redaction salt secure and rotate periodically');
    console.log('- Monitor performance impact in production');
    console.log('- Train staff on PII handling procedures');
  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  }
}

// Check if script is run directly
if (require.main === module) {
  main().catch(console.error);
}

export { demonstratePIIRedaction };
