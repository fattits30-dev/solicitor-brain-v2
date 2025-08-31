const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password123') {
    res.json({ 
      token: 'test-token-123',
      user: { 
        id: '1',
        username: 'admin', 
        email: 'admin@example.com',
        role: 'admin' 
      }
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', (req, res) => {
  // Check for authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === 'test-token-123') {
      res.json({
        user: {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin'
        }
      });
    } else {
      res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    res.status(401).json({ message: 'No token provided' });
  }
});

app.get('/api/stats', (req, res) => {
  res.json({
    activeCases: 24,
    documentsProcessed: 156,
    aiQueries: 42,
    privacyScore: 98
  });
});

app.get('/api/cases', (req, res) => {
  res.json([
    { 
      id: '1', 
      title: 'Smith vs Jones', 
      status: 'active',
      riskLevel: 'high',
      clientId: 'client-1',
      description: 'Employment dispute case',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updatedAt: new Date(Date.now() - 3600000).toISOString()   // 1 hour ago
    },
    { 
      id: '2', 
      title: 'Johnson Estate', 
      status: 'pending',
      riskLevel: 'medium',
      clientId: 'client-2',
      description: 'Property inheritance matter',
      createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      updatedAt: new Date(Date.now() - 7200000).toISOString()    // 2 hours ago
    },
    { 
      id: '3', 
      title: 'Contract Review - ABC Corp', 
      status: 'active',
      riskLevel: 'low',
      clientId: 'client-3',
      description: 'Commercial contract review',
      createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
      updatedAt: new Date(Date.now() - 43200000).toISOString()   // 12 hours ago
    }
  ]);
});

app.get('/api/documents/:id', (req, res) => {
  res.json({
    id: req.params.id,
    name: 'Sample Document.pdf',
    ocrText: 'This is sample extracted text from the document.',
    entities: [
      { type: 'Person', value: 'John Smith', confidence: 0.95 },
      { type: 'Date', value: '2024-01-15', confidence: 0.98 }
    ],
    pageCount: 5
  });
});

app.get('/api/search', (req, res) => {
  res.json({
    results: [
      {
        id: '1',
        documentId: 'doc1',
        documentName: 'Contract Agreement.pdf',
        excerpt: 'This agreement is made between...',
        score: 0.95,
        matchType: 'semantic',
        metadata: {
          date: '2024-01-15',
          author: 'Legal Team'
        }
      }
    ]
  });
});

app.post('/api/ai/chat', (req, res) => {
  const { message } = req.body;
  res.json({
    response: `AI Response to: ${message}`,
    model: 'llama3',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/ai/generate-draft', (req, res) => {
  const { templateName, formData } = req.body;
  res.json({
    content: `Generated ${templateName} draft with provided data`,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/templates', (req, res) => {
  res.json({
    templates: [
      {
        id: 'letter-response',
        name: 'Response Letter',
        category: 'Correspondence',
        description: 'Standard response letter template'
      }
    ]
  });
});

// Serve static files
const publicPath = path.join(__dirname, '..', 'dist', 'public');
app.use(express.static(publicPath));

// Catch all - serve React app
app.get('*', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built. Run: npm run build');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📋 Open your browser to http://localhost:${PORT}`);
  console.log(`🔍 Test the API: http://localhost:${PORT}/api/health`);
});