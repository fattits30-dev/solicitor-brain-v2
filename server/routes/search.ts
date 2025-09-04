import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { storage } from '../storage.js';
import { aiService } from '../services/real-ai.ts';

const router = Router();

// Simplified search endpoint that works with current storage API
router.post('/search', authenticate, async (req, res) => {
  try {
    const { 
      query, 
      caseId, 
      limit = 10
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log('Search request:', { query, caseId, limit });

    // Use AI service to search relevant documents
    const relevantDocs = await aiService.searchRelevantDocuments(query, caseId, limit);
    
    console.log('Found relevant docs:', relevantDocs.length);

    // Format results for the API response
    const searchResults = relevantDocs.map((doc, index) => ({
      id: doc.id,
      filename: doc.filename,
      type: doc.type,
      excerpt: doc.excerpt,
      relevanceScore: doc.relevanceScore,
      rank: index + 1
    }));

    // Also search cases by title/description if no caseId specified
    let caseResults = [];
    if (!caseId) {
      const allCases = await storage.getCases();
      const matchingCases = allCases.filter(c => 
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 5);

      caseResults = matchingCases.map(c => ({
        id: c.id,
        title: c.title,
        caseReference: c.caseReference,
        status: c.status,
        type: 'case',
        relevanceScore: 0.8
      }));
    }

    const response = {
      query,
      resultsCount: searchResults.length + caseResults.length,
      documents: searchResults,
      cases: caseResults,
      searchType: 'ai_assisted',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Quick document search by filename
router.get('/documents', authenticate, async (req, res) => {
  try {
    const { search, caseId } = req.query;
    
    let documents;
    if (caseId) {
      documents = await storage.getDocumentsByCase(caseId as string);
    } else {
      documents = await storage.getAllDocuments();
    }

    if (search) {
      const searchTerm = (search as string).toLowerCase();
      documents = documents.filter(doc => 
        doc.fileName.toLowerCase().includes(searchTerm)
      );
    }

    res.json({
      documents: documents.slice(0, 20), // Limit to 20 results
      total: documents.length
    });
  } catch (error) {
    console.error('Document search error:', error);
    res.status(500).json({ error: 'Document search failed' });
  }
});

export default router;