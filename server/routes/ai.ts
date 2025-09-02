import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { aiService } from '../services/real-ai.js';

const router = Router();

// Enhanced AI Chat endpoint with streaming support
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, context, mode = 'general', stream = false } = req.body;

    const startTime = Date.now();

    if (stream) {
      // Set headers for streaming
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      });

      const _response = await aiService.chatStream(message, {
        ...context,
        mode,
        onChunk: (chunk: string) => {
          res.write(chunk);
        },
      });

      res.end();
    } else {
      const response = await aiService.chat(message, {
        ...context,
        mode,
      });

      const processingTime = Date.now() - startTime;

      res.json({
        response,
        content: response,
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        confidence: 0.85,
        processingTime,
        timestamp: new Date().toISOString(),
      });
    }
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
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Summarization error:', error);
    res.status(500).json({ error: error.message || 'Summarization failed' });
  }
});

// List available AI models
router.get('/models', authenticate, async (req, res) => {
  try {
    const models = await aiService.listModels();
    res.json({
      models,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('List models error:', error);
    res.status(500).json({ error: error.message || 'Failed to list models' });
  }
});

export default router;
