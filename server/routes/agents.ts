import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Agent configuration
const agents = {
  chief: {
    name: 'Chief Legal Officer',
    model: 'dolphin-mixtral',
    role: 'Primary case analysis and strategy',
    status: 'active',
  },
  research: {
    name: 'Research Specialist',
    model: 'dolphin-mistral',
    role: 'Legal research and precedents',
    status: 'active',
  },
  document: {
    name: 'Document Analyst',
    model: 'llama3.2',
    role: 'Document review and analysis',
    status: 'active',
  },
  compliance: {
    name: 'Compliance Officer',
    model: 'mistral:7b-instruct',
    role: 'GDPR and regulatory compliance',
    status: 'active',
  },
  generator: {
    name: 'Document Generator',
    model: 'solar',
    role: 'Legal document drafting',
    status: 'active',
  },
  liaison: {
    name: 'Client Liaison',
    model: 'qwen2.5',
    role: 'Client communication and updates',
    status: 'active',
  },
};

// Helper to call Ollama
async function callOllama(model: string, prompt: string, system?: string) {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Ollama error:', error);
    throw error;
  }
}

// Get agent status
router.get('/agents/status', authenticate, async (req, res) => {
  try {
    const agentList = Object.entries(agents).map(([id, agent]) => ({
      id,
      ...agent,
    }));

    res.json({ agents: agentList });
  } catch {
    res.status(500).json({ error: 'Failed to get agent status' });
  }
});

// Analyze case with Chief Legal Officer
router.post('/agents/analyze-case', authenticate, async (req, res) => {
  try {
    const { caseData } = req.body;

    const prompt = `Analyze this legal case and provide strategic recommendations:
${JSON.stringify(caseData, null, 2)}

Provide:
1. Key legal issues identified
2. Recommended strategy
3. Risk assessment
4. Next steps`;

    const result = await callOllama(
      agents.chief.model,
      prompt,
      'You are a senior legal strategist specializing in UK law.',
    );

    res.json({
      chiefAnalysis: {
        result,
        agent: agents.chief.name,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to analyze case' });
  }
});

// Legal research
router.post('/agents/research', authenticate, async (req, res) => {
  try {
    const { query } = req.body;

    const prompt = `Research the following legal query:
${query}

Provide:
1. Relevant UK case law
2. Applicable statutes
3. Legal precedents
4. Summary of findings`;

    const result = await callOllama(
      agents.research.model,
      prompt,
      'You are a legal research specialist in UK law.',
    );

    res.json({
      research: {
        result,
        agent: agents.research.name,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to perform research' });
  }
});

// Document analysis
router.post('/agents/analyze-document', authenticate, async (req, res) => {
  try {
    const { documentContent, documentType } = req.body;

    const prompt = `Analyze this ${documentType || 'legal document'}:
${documentContent}

Provide:
1. Document summary
2. Key points and terms
3. Potential issues or concerns
4. Recommendations`;

    const result = await callOllama(
      agents.document.model,
      prompt,
      'You are a legal document analyst specializing in UK legal documents.',
    );

    res.json({
      analysis: {
        result,
        agent: agents.document.name,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to analyze document' });
  }
});

// Compliance check
router.post('/agents/compliance', authenticate, async (req, res) => {
  try {
    const { checkType, data } = req.body;

    const prompt = `Perform a ${checkType || 'GDPR'} compliance check:
${JSON.stringify(data, null, 2)}

Check for:
1. Data protection compliance
2. Required consents
3. Retention policies
4. Recommendations for compliance`;

    const result = await callOllama(
      agents.compliance.model,
      prompt,
      'You are a compliance officer specializing in UK GDPR and data protection law.',
    );

    res.json({
      compliance: {
        result,
        compliant: true, // Would need parsing of result
        agent: agents.compliance.name,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to check compliance' });
  }
});

// Generate document
router.post('/agents/generate-document', authenticate, async (req, res) => {
  try {
    const { documentType, data } = req.body;

    const prompt = `Generate a ${documentType || 'legal letter'} with the following information:
${JSON.stringify(data, null, 2)}

The document should be:
1. Professionally formatted
2. Legally accurate for UK
3. Clear and concise
4. Ready for review`;

    const result = await callOllama(
      agents.generator.model,
      prompt,
      'You are a legal document generator specializing in UK legal correspondence.',
    );

    res.json({
      document: {
        result,
        type: documentType,
        agent: agents.generator.name,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to generate document' });
  }
});

// Client communication
router.post('/agents/client-update', authenticate, async (req, res) => {
  try {
    const { caseUpdate, clientInfo } = req.body;

    const prompt = `Draft a client update based on:
Case Update: ${JSON.stringify(caseUpdate, null, 2)}
Client Info: ${JSON.stringify(clientInfo, null, 2)}

Create:
1. Clear summary of progress
2. Next steps explanation
3. Any required actions from client
4. Supportive and professional tone`;

    const result = await callOllama(
      agents.liaison.model,
      prompt,
      'You are a client liaison officer providing trauma-informed legal communication.',
    );

    res.json({
      clientUpdate: {
        result,
        agent: agents.liaison.name,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to generate client update' });
  }
});

// General chat endpoint
router.post('/agents/chat', authenticate, async (req, res) => {
  try {
    const { message, agentId = 'chief' } = req.body;
    const agent = agents[agentId as keyof typeof agents] || agents.chief;

    const result = await callOllama(agent.model, message, `You are ${agent.name}, ${agent.role}`);

    res.json({
      response: result,
      agent: agent.name,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;
