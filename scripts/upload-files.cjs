#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'http://localhost:3333/api';

const caseFiles = [
  { case: 'johnson-v-dwp', files: ['appeal-submission.txt', 'gp-evidence.txt', 'tribunal-decision.txt'] },
  { case: 'jones-v-vale', files: ['et1-claim-form.txt', 'et3-response.txt', 'tribunal-judgment.txt'] },
  { case: 'smith-v-camden', files: ['notice-of-appeal.txt', 'medical-evidence.txt', 'tribunal-decision.txt'] }
];

async function uploadFile(filePath, filename) {
  const form = new FormData();
  const fileContent = fs.readFileSync(filePath);
  
  form.append('file', fileContent, {
    filename: filename,
    contentType: 'text/plain'
  });

  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: form,
    headers: {
      ...form.getHeaders()
    }
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return response.json();
}

async function uploadAllFiles() {
  console.log('Starting file uploads...\n');

  for (const caseInfo of caseFiles) {
    console.log(`Uploading files for ${caseInfo.case}...`);
    
    for (const file of caseInfo.files) {
      const filePath = path.join(__dirname, '..', 'case-files', caseInfo.case, 'documents', file);
      
      if (fs.existsSync(filePath)) {
        try {
          const result = await uploadFile(filePath, `${caseInfo.case}-${file}`);
          console.log(`  ✓ Uploaded: ${file} (ID: ${result.id})`);
        } catch (error) {
          console.error(`  ✗ Failed to upload ${file}:`, error.message);
        }
      } else {
        console.log(`  ⚠ File not found: ${file}`);
      }
    }
    console.log();
  }

  console.log('✅ File upload complete!');
}

uploadAllFiles().catch(console.error);