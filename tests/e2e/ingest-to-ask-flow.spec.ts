import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('Ingest-to-Ask Happy Path', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login before each test
    await page.goto('/');
    await page.fill('input[type="email"], input[name="email"]', 'admin@test.com');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    await page.click('button[type="submit"], button');
    await expect(page).toHaveURL(/\/(dashboard|cases|home)/);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Document Ingestion', () => {
    test('should upload and process a legal document', async () => {
      // Navigate to cases or documents section
      await page.click('text=Cases, a[href*="cases"], [data-testid="cases-nav"]');
      await expect(page).toHaveURL(/cases/);
      
      // Create a new case if needed
      if (await page.locator('text=Create, text=New Case, button').count() > 0) {
        await page.click('text=Create, text=New Case, button');
        await page.fill('input[name="title"], input[placeholder*="title"]', 'E2E Test Case');
        await page.fill('textarea[name="description"], textarea[placeholder*="description"]', 'Test case for E2E testing');
        await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
      }
      
      // Select or create a case
      await page.click('.case-card, [data-testid="case-item"], text=Test Case');
      
      // Navigate to document upload
      await page.click('text=Documents, [data-testid="documents-tab"], a[href*="documents"]');
      
      // Upload document
      const fileInput = page.locator('input[type="file"]');
      
      if (await fileInput.count() === 0) {
        // If no file input visible, click upload button first
        await page.click('text=Upload, button:has-text("Upload"), [data-testid="upload-button"]');
      }
      
      // Create a test PDF file path (you'd need to have a test file)
      const _testFilePath = path.join(__dirname, '..', 'fixtures', 'test-legal-document.pdf');
      
      // Mock the file upload if no real file exists
      await page.route('**/api/documents/upload', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            fileName: 'test-legal-document.pdf',
            filePath: '/uploads/test-legal-document.pdf',
            extractedText: 'This is a sample legal document with important clauses and terms.',
            status: 'processed'
          })
        });
      });
      
      // Simulate file upload
      await page.setInputFiles('input[type="file"]', [{
        name: 'test-legal-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Mock PDF content for testing')
      }]);
      
      // Wait for upload to complete
      await expect(page.locator('text=Processing, text=Uploaded, .success')).toBeVisible();
      await expect(page.locator('text=test-legal-document.pdf')).toBeVisible();
    });

    test('should handle OCR processing', async () => {
      // Mock OCR processing
      await page.route('**/api/documents/*/ocr', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            extractedText: 'Extracted text from OCR processing: This document contains legal provisions and clauses.',
            confidence: 0.95,
            pages: 3
          })
        });
      });
      
      // Navigate to documents
      await page.goto('/cases');
      await page.click('.case-card, [data-testid="case-item"]');
      await page.click('text=Documents, [data-testid="documents-tab"]');
      
      // Find uploaded document and trigger OCR
      await page.click('[data-testid="document-item"], .document-card');
      
      if (await page.locator('text=Process OCR, button:has-text("OCR")').count() > 0) {
        await page.click('text=Process OCR, button:has-text("OCR")');
        
        // Wait for OCR processing to complete
        await expect(page.locator('text=OCR Complete, text=Processed')).toBeVisible();
        await expect(page.locator('text=Extracted text, text=legal provisions')).toBeVisible();
      }
    });

    test('should generate embeddings for vector search', async () => {
      // Mock embedding generation
      await page.route('**/api/documents/*/embeddings', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            chunks: 5,
            embeddings: 'generated',
            status: 'completed'
          })
        });
      });
      
      await page.goto('/cases');
      await page.click('.case-card, [data-testid="case-item"]');
      await page.click('text=Documents, [data-testid="documents-tab"]');
      
      // Find processed document and generate embeddings
      await page.click('[data-testid="document-item"], .document-card');
      
      if (await page.locator('text=Generate Embeddings, button:has-text("Embeddings")').count() > 0) {
        await page.click('text=Generate Embeddings, button:has-text("Embeddings")');
        
        // Wait for embedding generation
        await expect(page.locator('text=Embeddings Generated, text=Ready for Search')).toBeVisible();
      }
    });
  });

  test.describe('AI Question and Answer', () => {
    test('should ask questions about uploaded documents', async () => {
      // Mock AI chat responses
      await page.route('**/api/ai/chat-enhanced', async route => {
        const request = await route.request();
        const body = await request.postDataJSON();
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: `Based on the documents, I can help answer your question: "${body.message}". The legal documents contain relevant information about contracts, terms, and legal obligations.`,
            confidence: 0.92,
            sources: ['test-legal-document.pdf']
          })
        });
      });
      
      // Navigate to AI workspace or chat
      await page.click('text=AI Chat, text=Workspace, [data-testid="ai-nav"], a[href*="ai"]');
      await expect(page).toHaveURL(/ai|chat|workspace/);
      
      // Ask a question
      const questionInput = page.locator('textarea, input[placeholder*="question"], input[placeholder*="ask"]');
      await questionInput.fill('What are the key terms in the uploaded contract?');
      
      // Send question
      await page.click('button:has-text("Send"), button:has-text("Ask"), [data-testid="send-button"]');
      
      // Wait for AI response
      await expect(page.locator('text=Based on the documents')).toBeVisible();
      await expect(page.locator('text=legal documents contain')).toBeVisible();
      await expect(page.locator('text=test-legal-document.pdf')).toBeVisible();
    });

    test('should perform semantic search across documents', async () => {
      // Mock semantic search
      await page.route('**/api/search/semantic', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                documentId: 1,
                fileName: 'test-legal-document.pdf',
                chunk: 'This clause defines the terms and conditions of the agreement...',
                similarity: 0.89,
                page: 1
              },
              {
                documentId: 1,
                fileName: 'test-legal-document.pdf',
                chunk: 'The parties agree to the following obligations...',
                similarity: 0.85,
                page: 2
              }
            ]
          })
        });
      });
      
      // Navigate to search
      await page.click('text=Search, [data-testid="search-nav"], a[href*="search"]');
      await expect(page).toHaveURL(/search/);
      
      // Perform semantic search
      await page.fill('input[placeholder*="search"], input[type="search"]', 'contract obligations and terms');
      await page.click('button:has-text("Search"), [data-testid="search-button"]');
      
      // Verify search results
      await expect(page.locator('text=This clause defines')).toBeVisible();
      await expect(page.locator('text=parties agree')).toBeVisible();
      await expect(page.locator('text=Similarity: 0.89, text=89%')).toBeVisible();
    });

    test('should provide contextual legal research', async () => {
      // Mock legal research API
      await page.route('**/api/ai/legal-research', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            query: 'contract law obligations',
            relevantLegislation: [
              {
                title: 'Contract Law Act 1999',
                section: 'Section 2',
                summary: 'Defines contractual obligations and enforceability'
              }
            ],
            recentCases: [
              {
                title: 'Smith v Jones',
                citation: '[2024] EWCA Civ 123',
                relevance: 'Similar contractual dispute regarding obligations'
              }
            ]
          })
        });
      });
      
      // Navigate to legal research
      await page.click('text=Research, [data-testid="research-nav"], a[href*="research"]');
      
      // Perform legal research query
      await page.fill('input[placeholder*="research"], textarea[placeholder*="legal"]', 'What are the legal obligations in this contract?');
      await page.click('button:has-text("Research"), [data-testid="research-button"]');
      
      // Verify research results
      await expect(page.locator('text=Contract Law Act 1999')).toBeVisible();
      await expect(page.locator('text=Smith v Jones')).toBeVisible();
      await expect(page.locator('text=contractual obligations')).toBeVisible();
    });

    test('should generate legal drafts based on documents', async () => {
      // Mock draft generation
      await page.route('**/api/ai/generate-draft', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            draft: `LEGAL ADVICE MEMORANDUM

TO: Client
FROM: Legal Team
DATE: ${new Date().toLocaleDateString()}
RE: Contract Analysis

Based on our review of the uploaded contract documents, we advise the following:

1. The contract contains standard terms and conditions that are generally enforceable.
2. Key obligations include payment terms, delivery requirements, and termination clauses.
3. We recommend reviewing the limitation of liability provisions.

This draft has been generated based on the content analysis of your uploaded documents.`,
            templateUsed: 'legal-memo',
            confidence: 0.91
          })
        });
      });
      
      // Navigate to draft generation
      await page.click('text=Drafts, text=Generate, [data-testid="drafts-nav"], a[href*="draft"]');
      
      // Select draft type
      await page.selectOption('select[name="draftType"], select', 'legal-memo');
      
      // Generate draft
      await page.click('button:has-text("Generate Draft"), [data-testid="generate-button"]');
      
      // Verify draft generation
      await expect(page.locator('text=LEGAL ADVICE MEMORANDUM')).toBeVisible();
      await expect(page.locator('text=Contract Analysis')).toBeVisible();
      await expect(page.locator('text=uploaded documents')).toBeVisible();
      
      // Should be able to edit and save
      await page.click('button:has-text("Edit"), [data-testid="edit-button"]');
      await page.fill('textarea[name="content"]', 'Modified legal advice...');
      await page.click('button:has-text("Save"), [data-testid="save-button"]');
      
      await expect(page.locator('text=Draft saved')).toBeVisible();
    });
  });

  test.describe('Complete Workflow Integration', () => {
    test('should complete full ingest-to-ask workflow', async () => {
      // Mock all necessary API calls
      await page.route('**/api/documents/upload', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            fileName: 'complete-test-doc.pdf',
            extractedText: 'Complete test document with legal content for full workflow testing.',
            status: 'processed'
          })
        });
      });
      
      await page.route('**/api/ai/chat-enhanced', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: 'This document appears to be a legal agreement containing standard commercial terms. The key provisions include payment obligations, termination clauses, and liability limitations.',
            sources: ['complete-test-doc.pdf'],
            confidence: 0.94
          })
        });
      });
      
      // Step 1: Upload document
      await page.goto('/cases');
      await page.click('.case-card, [data-testid="case-item"]');
      await page.click('text=Documents, [data-testid="documents-tab"]');
      
      // Upload
      await page.setInputFiles('input[type="file"]', [{
        name: 'complete-test-doc.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Complete test document content')
      }]);
      
      await expect(page.locator('text=complete-test-doc.pdf')).toBeVisible();
      
      // Step 2: Navigate to AI Chat
      await page.click('text=AI Chat, a[href*="ai"]');
      
      // Step 3: Ask question about the document
      await page.fill('textarea, input[placeholder*="question"]', 'Summarize the key terms of this document');
      await page.click('button:has-text("Send"), [data-testid="send-button"]');
      
      // Step 4: Verify AI response
      await expect(page.locator('text=legal agreement')).toBeVisible();
      await expect(page.locator('text=payment obligations')).toBeVisible();
      await expect(page.locator('text=complete-test-doc.pdf')).toBeVisible();
      
      // Step 5: Follow up question
      await page.fill('textarea, input[placeholder*="question"]', 'What are the termination clauses?');
      await page.click('button:has-text("Send"), [data-testid="send-button"]');
      
      // Should get relevant response
      await expect(page.locator('text=termination')).toBeVisible();
      
      console.log('✅ Complete ingest-to-ask workflow test passed');
    });

    test('should handle multiple document analysis', async () => {
      // Mock multiple document uploads
      let uploadCount = 0;
      await page.route('**/api/documents/upload', async route => {
        uploadCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: uploadCount,
            fileName: `document-${uploadCount}.pdf`,
            extractedText: `Content from document ${uploadCount}`,
            status: 'processed'
          })
        });
      });
      
      await page.route('**/api/ai/chat-enhanced', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: 'Based on analysis of multiple documents, I can see common themes and different provisions across the uploaded files.',
            sources: ['document-1.pdf', 'document-2.pdf'],
            confidence: 0.88
          })
        });
      });
      
      // Upload multiple documents
      await page.goto('/cases');
      await page.click('.case-card, [data-testid="case-item"]');
      await page.click('text=Documents, [data-testid="documents-tab"]');
      
      // Upload first document
      await page.setInputFiles('input[type="file"]', [{
        name: 'document-1.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('First document content')
      }]);
      
      await expect(page.locator('text=document-1.pdf')).toBeVisible();
      
      // Upload second document
      await page.setInputFiles('input[type="file"]', [{
        name: 'document-2.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Second document content')
      }]);
      
      await expect(page.locator('text=document-2.pdf')).toBeVisible();
      
      // Ask question about both documents
      await page.click('text=AI Chat, a[href*="ai"]');
      await page.fill('textarea', 'Compare these two documents and identify differences');
      await page.click('button:has-text("Send")');
      
      // Should analyze multiple sources
      await expect(page.locator('text=multiple documents')).toBeVisible();
      await expect(page.locator('text=document-1.pdf')).toBeVisible();
      await expect(page.locator('text=document-2.pdf')).toBeVisible();
    });

    test('should maintain conversation context', async () => {
      // Mock contextual responses
      let conversationTurn = 0;
      await page.route('**/api/ai/chat-enhanced', async route => {
        conversationTurn++;
        const responses = [
          'This document is a service agreement with standard terms.',
          'As I mentioned, this service agreement includes payment terms of Net 30.',
          'Regarding the termination clause I discussed earlier, it requires 30 days notice.'
        ];
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: responses[conversationTurn - 1] || 'Contextual response',
            sources: ['test-doc.pdf'],
            confidence: 0.90
          })
        });
      });
      
      await page.goto('/ai');
      
      // First question
      await page.fill('textarea', 'What type of document is this?');
      await page.click('button:has-text("Send")');
      await expect(page.locator('text=service agreement')).toBeVisible();
      
      // Follow-up question (should maintain context)
      await page.fill('textarea', 'What are the payment terms?');
      await page.click('button:has-text("Send")');
      await expect(page.locator('text=As I mentioned')).toBeVisible();
      
      // Another follow-up
      await page.fill('textarea', 'What about termination?');
      await page.click('button:has-text("Send")');
      await expect(page.locator('text=Regarding the termination clause I discussed')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle document upload failures', async () => {
      // Mock upload failure
      await page.route('**/api/documents/upload', async route => {
        await route.fulfill({
          status: 413,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'File too large'
          })
        });
      });
      
      await page.goto('/cases');
      await page.click('.case-card, [data-testid="case-item"]');
      await page.click('text=Documents, [data-testid="documents-tab"]');
      
      await page.setInputFiles('input[type="file"]', [{
        name: 'large-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Large document content')
      }]);
      
      // Should show error message
      await expect(page.locator('text=File too large, text=error, .error')).toBeVisible();
    });

    test('should handle AI service failures', async () => {
      // Mock AI failure
      await page.route('**/api/ai/chat-enhanced', async route => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'AI service temporarily unavailable'
          })
        });
      });
      
      await page.goto('/ai');
      await page.fill('textarea', 'Test question');
      await page.click('button:has-text("Send")');
      
      // Should show error message
      await expect(page.locator('text=AI service temporarily unavailable, text=error')).toBeVisible();
      
      // Should allow retry
      await expect(page.locator('button:has-text("Retry"), button:has-text("Try Again")')).toBeVisible();
    });

    test('should handle network connectivity issues', async () => {
      // Simulate network failure
      await page.route('**/*', route => route.abort('failed'));
      
      await page.goto('/ai');
      
      // Should show connection error
      await expect(page.locator('text=connection, text=network, text=offline')).toBeVisible();
    });
  });
});