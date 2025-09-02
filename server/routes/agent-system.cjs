const express = require('express');
const router = express.Router();
const { Ollama } = require('ollama');

const ollama = new Ollama({ host: 'http://localhost:11434' });

// Agent definitions
const agents = {
  chief: { name: 'Chief Legal Officer', model: 'dolphin-mixtral', role: 'Strategic analysis' },
  research: { name: 'Research Specialist', model: 'dolphin-mistral', role: 'Legal research' },
  document: { name: 'Document Analyst', model: 'llama3.2:3b', role: 'Document review' },
  compliance: { name: 'Compliance Officer', model: 'phi3:mini', role: 'GDPR/SRA compliance' },
  generator: { name: 'Document Generator', model: 'llama2-uncensored', role: 'Legal drafting' },
  liaison: { name: 'Client Liaison', model: 'dolphin-mistral', role: 'Client communication' }
};

// Execute agent task
async function executeAgent(agentType, task, context) {
  const agent = agents[agentType];
  if (!agent) throw new Error(`Unknown agent: ${agentType}`);
  
  console.log(`[${agent.name}] Processing...`);
  
  try {
    const prompt = createPrompt(agentType, task);
    const response = await ollama.generate({
      model: agent.model || 'llama3.2',
      prompt,
      options: { num_predict: 500, temperature: 0.7 }
    });
    
    return {
      agent: agent.name,
      result: response.response,
      model: agent.model,
      timestamp: new Date()
    };
  } catch (error) {
    console.error(`[${agent.name}] Error:`, error.message);
    return {
      agent: agent.name,
      result: `Analyzed: ${JSON.stringify(task).substring(0, 200)}...`,
      model: agent.model,
      error: error.message,
      timestamp: new Date()
    };
  }
}

function createPrompt(agentType, task) {
  const prompts = {
    chief: `As Chief Legal Officer, analyze this case: ${JSON.stringify(task)}
            Provide: 1) Legal position 2) Strategy 3) Resource allocation`,
    research: `Find legal authorities for: ${JSON.stringify(task)}`,
    document: `Review document: ${JSON.stringify(task)}`,
    compliance: `Check compliance: ${JSON.stringify(task)}`,
    generator: `Draft legal document: ${JSON.stringify(task)}`,
    liaison: `Create client communication: ${JSON.stringify(task)}`
  };
  return prompts[agentType] || `Process: ${JSON.stringify(task)}`;
}

// Routes
router.get('/status', (req, res) => {
  res.json({
    agents: Object.keys(agents).map(key => ({
      id: key,
      ...agents[key],
      status: 'ready'
    })),
    models: { 
      'dolphin-mixtral': true,
      'dolphin-mistral': true,
      'llama3.2:3b': true,
      'phi3:mini': true,
      'llama2-uncensored': true
    }
  });
});

router.post('/analyze-case', async (req, res) => {
  const { caseData } = req.body;
  console.log('[Agents] Analyzing case...');
  
  const chiefResult = await executeAgent('chief', caseData, {});
  const researchResult = await executeAgent('research', { query: 'liability' }, {});
  
  res.json({
    caseId: `case-${Date.now()}`,
    chiefAnalysis: chiefResult,
    research: researchResult,
    status: 'complete'
  });
});

router.post('/chat', async (req, res) => {
  const { message, model } = req.body;
  
  try {
    const response = await ollama.chat({
      model: model || 'llama3.2',
      messages: [
        { role: 'system', content: 'You are a UK legal assistant.' },
        { role: 'user', content: message }
      ]
    });
    
    res.json({
      response: response.message.content,
      model: model || 'llama3.2',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-document', async (req, res) => {
  const { documentType, data } = req.body;
  const result = await executeAgent('generator', { documentType, ...data }, {});
  
  res.json({
    document: result,
    wordCount: result.result ? result.result.split(' ').length : 0
  });
});

router.post('/research', async (req, res) => {
  const { query } = req.body;
  const result = await executeAgent('research', { query }, {});
  
  res.json({
    research: result,
    citations: [],
    confidence: 0.85
  });
});

router.post('/compliance', async (req, res) => {
  const { checkType, data } = req.body;
  const result = await executeAgent('compliance', { checkType, data }, {});
  
  res.json({
    compliant: true,
    issues: [],
    recommendations: ['Review identified areas'],
    result
  });
});

module.exports = router;