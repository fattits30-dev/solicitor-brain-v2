import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { storage } from '../storage.js';
import { aiService } from '../services/real-ai.js';

const router = Router();

// Vector search endpoint with RAG capabilities
router.post('/search', authenticate, async (req, res) => {
  try {
    const { 
      query, 
      caseId, 
      filters = {}, 
      limit = 10, 
      searchType = 'hybrid' // 'vector', 'keyword', 'hybrid'
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Generate embedding for the query
    const queryEmbedding = await aiService.generateEmbedding(query);

    // Build search query based on type
    let searchResults = [];
    
    if (searchType === 'vector' || searchType === 'hybrid') {
      // Vector similarity search using pgvector
      const vectorQuery = `
        SELECT 
          c.id,
          c.text,
          c.document_id,
          c.page_number,
          c.chunk_index,
          d.filename,
          d.case_id,
          d.type as doc_type,
          d.created_at,
          cases.title as case_title,
          cases.client_ref,
          1 - (c.embedding <=> $1::vector) as similarity
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        LEFT JOIN cases ON d.case_id = cases.id
        WHERE 1=1
          ${caseId ? 'AND d.case_id = $2' : ''}
          ${filters.documentType ? 'AND d.type = $3' : ''}
        ORDER BY c.embedding <=> $1::vector
        LIMIT $4
      `;

      const params = [
        JSON.stringify(queryEmbedding),
        ...(caseId ? [caseId] : []),
        ...(filters.documentType ? [filters.documentType] : []),
        limit
      ];

      const vectorResults = await storage.db.query(vectorQuery, params);
      searchResults = vectorResults.rows;
    }

    if (searchType === 'keyword' || searchType === 'hybrid') {
      // Full-text search fallback
      const textQuery = `
        SELECT 
          c.id,
          c.text,
          c.document_id,
          c.page_number,
          c.chunk_index,
          d.filename,
          d.case_id,
          d.type as doc_type,
          d.created_at,
          cases.title as case_title,
          cases.client_ref,
          ts_rank(to_tsvector('english', c.text), plainto_tsquery('english', $1)) as relevance
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        LEFT JOIN cases ON d.case_id = cases.id
        WHERE to_tsvector('english', c.text) @@ plainto_tsquery('english', $1)
          ${caseId ? 'AND d.case_id = $2' : ''}
          ${filters.documentType ? 'AND d.type = $3' : ''}
        ORDER BY relevance DESC
        LIMIT $4
      `;

      const params = [
        query,
        ...(caseId ? [caseId] : []),
        ...(filters.documentType ? [filters.documentType] : []),
        limit
      ];

      const textResults = await storage.db.query(textQuery, params);
      
      // Merge results if hybrid search
      if (searchType === 'hybrid' && searchResults.length > 0) {
        // Combine and deduplicate results
        const combined = [...searchResults, ...textResults.rows];
        const uniqueResults = new Map();
        
        combined.forEach(result => {
          const existing = uniqueResults.get(result.id);
          if (!existing || (result.similarity || result.relevance) > (existing.similarity || existing.relevance)) {
            uniqueResults.set(result.id, result);
          }
        });
        
        searchResults = Array.from(uniqueResults.values())
          .sort((a, b) => (b.similarity || b.relevance || 0) - (a.similarity || a.relevance || 0))
          .slice(0, limit);
      } else if (searchType === 'keyword') {
        searchResults = textResults.rows;
      }
    }

    // Format results with citations
    const formattedResults = searchResults.map(result => ({
      id: result.id,
      documentId: result.document_id,
      documentName: result.filename,
      caseId: result.case_id,
      caseTitle: result.case_title,
      caseRef: result.client_ref,
      snippet: result.text.substring(0, 300) + '...',
      page: result.page_number,
      chunkIndex: result.chunk_index,
      score: result.similarity || result.relevance || 0,
      type: result.doc_type,
      createdAt: result.created_at,
      citation: {
        source: result.filename,
        page: result.page_number,
        confidence: result.similarity || result.relevance || 0
      }
    }));

    // Log search for audit
    await storage.db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        req.user?.id,
        'search',
        'search_query',
        null,
        JSON.stringify({ 
          query, 
          resultsCount: formattedResults.length,
          searchType,
          filters 
        }),
        req.ip
      ]
    );

    res.json({
      query,
      searchType,
      total: formattedResults.length,
      results: formattedResults,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search failed', 
      message: error.message 
    });
  }
});

// Get search suggestions based on partial query
router.get('/search/suggestions', authenticate, async (req, res) => {
  try {
    const { q, caseId } = req.query;
    
    if (!q || String(q).length < 2) {
      return res.json({ suggestions: [] });
    }

    // Get suggestions from recent searches and document titles
    const query = `
      SELECT DISTINCT 
        COALESCE(d.filename, c.text) as suggestion,
        COUNT(*) as frequency
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE (
        d.filename ILIKE $1 OR 
        c.text ILIKE $1
      )
      ${caseId ? 'AND d.case_id = $2' : ''}
      GROUP BY suggestion
      ORDER BY frequency DESC
      LIMIT 10
    `;

    const params = [
      `%${q}%`,
      ...(caseId ? [caseId] : [])
    ];

    const result = await storage.db.query(query, params);
    
    res.json({
      suggestions: result.rows.map(r => r.suggestion),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Suggestions error:', error);
    res.status(500).json({ 
      error: 'Failed to get suggestions',
      suggestions: [] 
    });
  }
});

// Get search history for current user
router.get('/search/history', authenticate, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const query = `
      SELECT 
        details->>'query' as query,
        details->>'resultsCount' as results_count,
        created_at
      FROM audit_log
      WHERE user_id = $1 
        AND action = 'search'
        AND details->>'query' IS NOT NULL
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await storage.db.query(query, [req.user?.id, limit]);
    
    res.json({
      history: result.rows,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Search history error:', error);
    res.status(500).json({ 
      error: 'Failed to get search history',
      history: [] 
    });
  }
});

export default router;