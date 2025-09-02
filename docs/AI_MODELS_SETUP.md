# AI Models Configuration for Agent System

## 🤖 Model Categories

### Main Agent Models (Large, Powerful)
- **mixtral:8x7b** - 26GB, excellent reasoning, best for complex legal analysis
- **llama3.2:latest** - 2GB, balanced, good general purpose
- **llama3.1:8b** - 4.9GB, strong comprehension

### Mini Agent Models (Fast, Efficient)  
- **phi3:mini** - <2GB, Microsoft's efficient model, great for quick tasks
- **tinyllama** - 637MB, ultra-fast for simple queries
- **orca-mini** - 2GB, good for structured responses

### Specialized Models
- **codellama:7b** - 3.8GB, code generation and analysis
- **mistral:7b-instruct** - 4.1GB, excellent instruction following
- **neural-chat:7b** - ~4GB, conversational AI
- **dolphin-mixtral** - 26GB, uncensored reasoning
- **dolphin-mistral** - 4.1GB, uncensored smaller model

### Embedding Models
- **nomic-embed-text** - 274MB, text embeddings
- **mxbai-embed-large** - ~500MB, higher quality embeddings

## 🎯 Agent System Architecture

```yaml
Main Agent:
  Primary: mixtral:8x7b or llama3.1:8b
  Tasks: 
    - Complex legal analysis
    - Document review
    - Case strategy
    - Multi-step reasoning

Mini Agents:
  Primary: phi3:mini or tinyllama
  Tasks:
    - Quick lookups
    - Simple Q&A
    - Data extraction
    - Form validation

Code Agent:
  Primary: codellama:7b
  Tasks:
    - Generate legal templates
    - SQL queries
    - API integration code

Embedding Agent:
  Primary: mxbai-embed-large
  Tasks:
    - Document similarity
    - Semantic search
    - Case matching
```

## 📝 Configuration in .env

```bash
# Main Agent
MAIN_AGENT_MODEL=mixtral:8x7b
MAIN_AGENT_FALLBACK=llama3.1:8b

# Mini Agents
MINI_AGENT_MODEL=phi3:mini
MINI_AGENT_FALLBACK=tinyllama

# Specialized
CODE_MODEL=codellama:7b
CHAT_MODEL=neural-chat:7b
EMBEDDING_MODEL=mxbai-embed-large
```

## 🚀 Usage Examples

### Main Agent (Complex Task)
```javascript
// For complex legal analysis
const response = await aiService.chat(query, {
  model: 'mixtral:8x7b',
  mode: 'legal-analysis',
  temperature: 0.7
});
```

### Mini Agent (Quick Task)
```javascript
// For quick data extraction
const response = await aiService.chat(query, {
  model: 'phi3:mini',
  mode: 'extraction',
  temperature: 0.3
});
```

### Code Generation
```javascript
// Generate legal template
const template = await aiService.generateCode({
  model: 'codellama:7b',
  prompt: 'Create UK employment contract template',
  language: 'markdown'
});
```

## 🔧 Performance Optimization

### With GPU (AMD RX 6600)
- Enable ROCm support (requires restart after adding to video group)
- Expected 2-5x speedup for inference
- Mixtral will benefit most from GPU acceleration

### Model Loading Strategy
1. Keep mini models (tinyllama, phi3) always loaded
2. Load main models on-demand
3. Unload after 30 minutes of inactivity
4. Use fallback models if primary unavailable

## 📊 Resource Requirements

| Model | RAM Required | Disk Space | GPU VRAM |
|-------|-------------|------------|----------|
| mixtral:8x7b | 32GB | 26GB | 8GB+ |
| llama3.1:8b | 8GB | 5GB | 6GB |
| codellama:7b | 8GB | 4GB | 6GB |
| phi3:mini | 2GB | 2GB | 2GB |
| tinyllama | 1GB | 637MB | 1GB |

## 🎮 Testing Commands

```bash
# Test main agent
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "mixtral:8x7b", "prompt": "Analyze UK employment law"}'

# Test mini agent  
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "phi3:mini", "prompt": "Extract date from: Meeting on January 15, 2024"}'

# Test embeddings
curl -X POST http://localhost:11434/api/embeddings \
  -d '{"model": "mxbai-embed-large", "prompt": "employment termination"}'
```

## ✅ Status
- Models currently downloading
- GPU support configured (requires logout/login)
- Integration with Solicitor Brain ready