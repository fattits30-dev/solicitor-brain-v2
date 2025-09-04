import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Validation schemas
const createChatSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['general', 'case-specific', 'document-analysis', 'legal-research']),
  caseId: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  model: z.string().default('llama3.2:3b'),
  caseId: z.string().optional(),
});

// Mock data for development
const mockChats = [
  {
    id: '1',
    title: 'Contract Review Discussion',
    type: 'document-analysis',
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Please review this employment contract for potential issues.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '2',
        role: 'assistant',
        content:
          "I've analyzed the contract and found several key areas that need attention: 1) The non-compete clause is overly broad and may not be enforceable, 2) The termination notice period of 30 days is standard, 3) The intellectual property assignment clause is comprehensive and appropriate.",
        timestamp: new Date(Date.now() - 3500000).toISOString(),
        metadata: {
          confidence: 0.92,
          processingTime: 2.3,
          sources: [
            { id: '1', title: 'Employment Contract Template', type: 'document', relevance: 0.95 },
            { id: '2', title: 'Non-compete Law Guidelines', type: 'statute', relevance: 0.87 },
          ],
        },
      },
    ],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 3500000).toISOString(),
    caseId: '1',
  },
  {
    id: '2',
    title: 'Legal Research Query',
    type: 'legal-research',
    messages: [
      {
        id: '3',
        role: 'user',
        content:
          'What are the recent changes to UK data protection law that might affect our privacy policy?',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: '4',
        role: 'assistant',
        content:
          'Recent updates to UK data protection law include: 1) The UK GDPR maintains most GDPR principles but with UK-specific implementations, 2) The Data Protection Act 2018 provides additional framework, 3) Recent ICO guidance on cookies and consent has been updated. I recommend reviewing your privacy policy against these current requirements.',
        timestamp: new Date(Date.now() - 1700000).toISOString(),
        metadata: {
          confidence: 0.88,
          processingTime: 3.1,
          sources: [
            { id: '3', title: 'UK GDPR Guidelines', type: 'statute', relevance: 0.93 },
            { id: '4', title: 'ICO Cookie Guidance', type: 'statute', relevance: 0.85 },
          ],
        },
      },
    ],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1700000).toISOString(),
  },
];

const mockTasks = [
  {
    id: '1',
    type: 'document-summary',
    title: 'Summarizing Contract Documents',
    description: 'Analyzing 5 contract documents for key terms and risks',
    status: 'processing',
    progress: 75,
    createdAt: new Date(Date.now() - 1200000).toISOString(),
    caseId: '1',
  },
  {
    id: '2',
    type: 'legal-research',
    title: 'Employment Law Research',
    description: 'Researching recent employment law changes in UK',
    status: 'completed',
    progress: 100,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 1800000).toISOString(),
    result: {
      summary: 'Found 12 relevant cases and 3 statute updates',
      recommendations: ['Update employment contracts', 'Review disciplinary procedures'],
    },
  },
  {
    id: '3',
    type: 'risk-assessment',
    title: 'Contract Risk Analysis',
    description: 'Assessing legal risks in new partnership agreement',
    status: 'pending',
    progress: 0,
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
];

const mockInsights = [
  {
    id: '1',
    type: 'risk-alert',
    title: 'High Risk Contract Clause Detected',
    description:
      'The unlimited liability clause in Contract-2024-001 poses significant financial risk',
    severity: 'high',
    confidence: 0.94,
    source: 'Document Analysis AI',
    actionRequired: true,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    documentId: '123',
  },
  {
    id: '2',
    type: 'deadline-reminder',
    title: 'Court Filing Deadline Approaching',
    description: 'Case Smith vs. Johnson has a filing deadline in 3 days',
    severity: 'critical',
    confidence: 1.0,
    source: 'Calendar Integration',
    actionRequired: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    caseId: '2',
  },
  {
    id: '3',
    type: 'pattern-detection',
    title: 'Similar Case Patterns Found',
    description: 'This case shows similar patterns to 3 previous successful outcomes',
    severity: 'medium',
    confidence: 0.78,
    source: 'Pattern Recognition AI',
    actionRequired: false,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    caseId: '1',
  },
  {
    id: '4',
    type: 'recommendation',
    title: 'Document Organization Suggestion',
    description:
      'Consider consolidating related documents in Case-2024-003 for better organization',
    severity: 'low',
    confidence: 0.67,
    source: 'Workflow Optimization AI',
    actionRequired: false,
    createdAt: new Date(Date.now() - 900000).toISOString(),
    caseId: '3',
  },
];

// Get AI chats
router.get('/chats', authenticate, async (req, res) => {
  try {
    const { caseId } = req.query;

    let filteredChats = mockChats;
    if (caseId && caseId !== 'all') {
      filteredChats = mockChats.filter((chat) => chat.caseId === caseId);
    }

    res.json(filteredChats);
  } catch (error) {
    console.error('Error fetching AI chats:', error);
    res.status(500).json({ error: 'Failed to fetch AI chats' });
  }
});

// Create new AI chat
router.post('/chats', authenticate, async (req, res) => {
  try {
    const validation = createChatSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid input', details: validation.error });
    }

    const { title, type, caseId } = validation.data;

    const newChat = {
      id: Date.now().toString(),
      title,
      type,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      caseId,
    };

    // In a real implementation, save to database
    mockChats.unshift(newChat);

    res.status(201).json(newChat);
  } catch (error) {
    console.error('Error creating AI chat:', error);
    res.status(500).json({ error: 'Failed to create AI chat' });
  }
});

// Send message to AI chat
router.post('/chats/:chatId/messages', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const validation = sendMessageSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid input', details: validation.error });
    }

    const { content, model } = validation.data;
    const chat = mockChats.find((c) => c.id === chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    };

    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Generate mock AI response
    const aiResponses = [
      'Based on my analysis of the legal documents and relevant case law, I can provide the following insights:',
      'After reviewing the applicable statutes and regulations, here are my recommendations:',
      "I've analyzed this matter from multiple legal perspectives. Here's what you should consider:",
      'Drawing from similar cases and legal precedents, I can offer these observations:',
      'My analysis indicates several key factors that require your attention:',
    ];

    const aiMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content:
        aiResponses[Math.floor(Math.random() * aiResponses.length)] +
        ' ' +
        'This is a mock AI response for demonstration purposes. In a production environment, this would integrate with your chosen AI model.',
      timestamp: new Date().toISOString(),
      metadata: {
        confidence: 0.75 + Math.random() * 0.2,
        processingTime: 1.5 + Math.random() * 2,
        model,
        sources: [
          { id: '1', title: 'Legal Document Analysis', type: 'document' as const, relevance: 0.9 },
          { id: '2', title: 'Case Law Database', type: 'case-law' as const, relevance: 0.8 },
        ],
      },
    };

    chat.messages.push(userMessage, aiMessage);
    chat.updatedAt = new Date().toISOString();

    res.json({ userMessage, aiMessage });
  } catch (error) {
    console.error('Error sending message to AI chat:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get AI tasks
router.get('/tasks', authenticate, async (req, res) => {
  try {
    res.json(mockTasks);
  } catch (error) {
    console.error('Error fetching AI tasks:', error);
    res.status(500).json({ error: 'Failed to fetch AI tasks' });
  }
});

// Get AI insights
router.get('/insights', authenticate, async (req, res) => {
  try {
    res.json(mockInsights);
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    res.status(500).json({ error: 'Failed to fetch AI insights' });
  }
});

// Get specific AI chat
router.get('/chats/:chatId', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = mockChats.find((c) => c.id === chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error fetching AI chat:', error);
    res.status(500).json({ error: 'Failed to fetch AI chat' });
  }
});

// Delete AI chat
router.delete('/chats/:chatId', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const chatIndex = mockChats.findIndex((c) => c.id === chatId);

    if (chatIndex === -1) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    mockChats.splice(chatIndex, 1);
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting AI chat:', error);
    res.status(500).json({ error: 'Failed to delete AI chat' });
  }
});

export default router;
