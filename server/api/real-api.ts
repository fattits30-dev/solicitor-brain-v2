import express from 'express';
import { aiService } from '../services/real-ai';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:development_secure_2024@localhost:5432/solicitor_brain_v2'
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

// ============ REAL AUTHENTICATION ============
router.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Store in database
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ token, user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Get user from database
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ 
      token, 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ REAL AI ENDPOINTS ============
router.post('/ai/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    const response = await aiService.chat(message, context);
    res.json({ response, model: 'llama3.2', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/analyze-document', async (req, res) => {
  try {
    const { content } = req.body;
    const analysis = await aiService.analyzeDocument(content);
    res.json(analysis);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/generate-draft', async (req, res) => {
  try {
    const { template, data } = req.body;
    const draft = await aiService.generateDraft(template, data);
    res.json({ content: draft, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/summarize', async (req, res) => {
  try {
    const { text } = req.body;
    const summary = await aiService.summarize(text);
    res.json({ summary, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ REAL FILE UPLOAD ============
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let content = '';
    
    // Extract text from PDF
    if (req.file.mimetype === 'application/pdf') {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      content = pdfData.text;
    } else {
      content = await fs.readFile(filePath, 'utf-8');
    }
    
    // Generate embedding
    const embedding = await aiService.generateEmbedding(content.substring(0, 1000));
    
    // Store in database
    const result = await pool.query(
      'INSERT INTO documents (filename, content, embedding, uploaded_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
      [req.file.originalname, content, JSON.stringify(embedding)]
    );
    
    // Analyze document
    const analysis = await aiService.analyzeDocument(content);
    
    res.json({
      id: result.rows[0].id,
      filename: req.file.originalname,
      analysis,
      message: 'File uploaded and processed successfully'
    });
    
    // Clean up
    await fs.unlink(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ REAL SEARCH WITH EMBEDDINGS ============
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query required' });
    }
    
    // Generate embedding for query
    const queryEmbedding = await aiService.generateEmbedding(q as string);
    
    // Search using pgvector
    const result = await pool.query(
      `SELECT id, filename, content,
       1 - (embedding <=> $1::vector) as similarity
       FROM documents
       ORDER BY similarity DESC
       LIMIT 10`,
      [JSON.stringify(queryEmbedding)]
    );
    
    res.json({
      query: q,
      results: result.rows.map(row => ({
        id: row.id,
        filename: row.filename,
        excerpt: row.content.substring(0, 200) + '...',
        similarity: row.similarity
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ REAL CASES MANAGEMENT ============
router.get('/cases', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cases ORDER BY updated_at DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/cases', async (req, res) => {
  try {
    const { title, description, client_id } = req.body;
    const result = await pool.query(
      'INSERT INTO cases (title, description, client_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
      [title, description, client_id, 'active']
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;