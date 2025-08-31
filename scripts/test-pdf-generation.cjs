#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3333/api';

async function testPDFGeneration() {
  console.log('Testing PDF Generation...\n');

  // Read a case file
  const caseFilePath = path.join(__dirname, '..', 'case-files', 'johnson-v-dwp', 'documents', 'tribunal-decision.txt');
  const content = fs.readFileSync(caseFilePath, 'utf-8');

  // Generate PDF
  const response = await fetch(`${API_URL}/documents/generate-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Johnson v DWP - Tribunal Decision',
      content: content,
      type: 'judgment',
      metadata: {
        caseNumber: 'SC242/24/00892',
        date: '22 March 2024',
        confidential: true
      }
    })
  });

  if (response.ok) {
    const pdfBuffer = await response.arrayBuffer();
    const outputPath = path.join(__dirname, '..', 'test-output.pdf');
    fs.writeFileSync(outputPath, Buffer.from(pdfBuffer));
    console.log(`✅ PDF generated successfully: ${outputPath}`);
    console.log(`   Size: ${(pdfBuffer.byteLength / 1024).toFixed(2)} KB`);
  } else {
    const error = await response.text();
    console.error(`❌ PDF generation failed: ${error}`);
  }
}

testPDFGeneration().catch(console.error);