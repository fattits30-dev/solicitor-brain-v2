#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3333/api';
const TOKEN = 'test-token-123';

const cases = [
  {
    name: 'johnson-v-dwp',
    title: 'R (Johnson) v Secretary of State for Work and Pensions',
    type: 'PIP Appeal',
    caseNumber: 'UTAAC/2024/PIP/0892',
    client: 'Rebecca Johnson',
    status: 'completed'
  },
  {
    name: 'jones-v-vale',
    title: 'Jones v Vale Curtains and Blinds Ltd',
    type: 'Employment Tribunal',
    caseNumber: 'ET/2024/00456',
    client: 'David Jones',
    status: 'completed'
  },
  {
    name: 'smith-v-camden',
    title: 'Smith v London Borough of Camden',
    type: 'Housing Benefit Appeal',
    caseNumber: 'HB/2024/CAM/0234',
    client: 'Margaret Smith',
    status: 'completed'
  }
];

async function makeRequest(endpoint, data) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return response.json();
}

async function uploadCases() {
  console.log('Starting case file upload...\n');

  for (const caseInfo of cases) {
    console.log(`Processing ${caseInfo.name}...`);
    
    try {
      // Create the case
      const caseData = await makeRequest('/cases', {
        title: caseInfo.title,
        type: caseInfo.type,
        caseNumber: caseInfo.caseNumber,
        client: caseInfo.client,
        status: caseInfo.status,
        description: `Complete case file for ${caseInfo.title}`,
        priority: 'high'
      });

      const caseId = caseData.id;
      console.log(`  ✓ Created case with ID: ${caseId}`);

      // Upload documents
      const documentsPath = path.join(__dirname, '..', 'case-files', caseInfo.name, 'documents');
      
      if (fs.existsSync(documentsPath)) {
        const documents = fs.readdirSync(documentsPath);
        
        for (const doc of documents) {
          const docPath = path.join(documentsPath, doc);
          const content = fs.readFileSync(docPath, 'utf-8');
          
          try {
            await makeRequest('/documents', {
              title: doc.replace('.txt', '').replace(/-/g, ' ').toUpperCase(),
              content: content,
              type: doc.includes('evidence') ? 'evidence' : 
                    doc.includes('appeal') ? 'appeal' :
                    doc.includes('decision') || doc.includes('judgment') ? 'judgment' :
                    doc.includes('et1') || doc.includes('et3') ? 'form' : 'correspondence',
              caseId: caseId,
              metadata: {
                originalFilename: doc,
                caseReference: caseInfo.caseNumber,
                uploadedAt: new Date().toISOString()
              }
            });

            console.log(`    ✓ Uploaded: ${doc}`);
          } catch (error) {
            console.error(`    ✗ Failed to upload ${doc}:`, error.message);
          }
        }
      }

      // Upload case summary
      const summaryPath = path.join(__dirname, '..', 'case-files', caseInfo.name, 'case-summary.json');
      if (fs.existsSync(summaryPath)) {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        
        try {
          await makeRequest('/documents', {
            title: 'Case Summary',
            content: JSON.stringify(summary, null, 2),
            type: 'summary',
            caseId: caseId,
            metadata: {
              dataType: 'json',
              caseReference: caseInfo.caseNumber
            }
          });
          
          console.log(`    ✓ Uploaded case summary`);
        } catch (error) {
          console.error(`    ✗ Failed to upload summary:`, error.message);
        }
      }

      console.log(`  ✓ Completed ${caseInfo.name}\n`);
      
    } catch (error) {
      console.error(`  ✗ Failed to create case ${caseInfo.name}:`, error.message);
    }
  }
  
  console.log('✅ Case file upload complete!');
}

// Run the upload
uploadCases().catch(console.error);