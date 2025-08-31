import { Router } from 'express';
import { aiService } from '../services/real-ai.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// AI Chat endpoint with real Ollama
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, context } = req.body;
    const response = await aiService.chat(message, context);
    res.json({ 
      response, 
      model: 'llama3.2',
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: error.message || 'AI service unavailable' });
  }
});

// Analyze document with real AI
router.post('/analyze-document', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const analysis = await aiService.analyzeDocument(content);
    res.json(analysis);
  } catch (error: any) {
    console.error('Document analysis error:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

// Generate draft with real AI
router.post('/generate-draft', authenticate, async (req, res) => {
  try {
    const { template, data } = req.body;
    const draft = await aiService.generateDraft(template, data);
    res.json({ 
      content: draft,
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    console.error('Draft generation error:', error);
    res.status(500).json({ error: error.message || 'Draft generation failed' });
  }
});

// Summarize text with real AI
router.post('/summarize', authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    const summary = await aiService.summarize(text);
    res.json({ 
      summary,
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    console.error('Summarization error:', error);
    res.status(500).json({ error: error.message || 'Summarization failed' });
  }
});

export default router;