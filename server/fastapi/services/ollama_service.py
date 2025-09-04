import httpx
import structlog
from typing import List, Dict, Any, Optional
from config import settings

logger = structlog.get_logger(__name__)


class OllamaService:
    def __init__(self):
        self.base_url = settings.ollama_host
        self.embedding_model = settings.embedding_model
        self.chat_model = settings.chat_model
        self.code_model = settings.code_model

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embeddings for text using Ollama."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={
                        "model": self.embedding_model,
                        "prompt": text
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                return result["embedding"]
        except Exception as e:
            logger.error("Failed to generate embedding", error=str(e))
            raise Exception(f"Embedding generation failed: {str(e)}")

    async def chat(self, message: str, context: Optional[str] = None, model: Optional[str] = None) -> str:
        """Chat with Ollama model."""
        try:
            model_to_use = model or self.chat_model
            
            system_prompt = "You are a helpful legal assistant specializing in UK law. Provide accurate, professional advice while being empathetic to clients."
            
            if context:
                system_prompt += f"\n\nContext from documents:\n{context}"

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": model_to_use,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": message}
                        ],
                        "stream": False
                    },
                    timeout=120.0
                )
                response.raise_for_status()
                result = response.json()
                return result["message"]["content"]
        except Exception as e:
            logger.error("Chat request failed", error=str(e))
            raise Exception(f"Chat request failed: {str(e)}")

    async def analyze_document(self, content: str) -> Dict[str, Any]:
        """Analyze a document and extract key information."""
        try:
            prompt = f"""Analyze this legal document and extract the following information in JSON format:
{{
    "key_parties": ["list of parties involved"],
    "important_dates": ["list of important dates"],
    "legal_issues": ["list of main legal issues"],
    "risk_assessment": "high/medium/low",
    "recommended_actions": ["list of recommended actions"],
    "summary": "brief summary of the document"
}}

Document content:
{content[:3000]}"""

            analysis = await self.chat(prompt, model=self.chat_model)
            
            # Try to parse JSON from the response
            import json
            try:
                # Extract JSON from the response (in case there's additional text)
                start = analysis.find('{')
                end = analysis.rfind('}') + 1
                if start != -1 and end > start:
                    json_str = analysis[start:end]
                    parsed_data = json.loads(json_str)
                else:
                    # Fallback if JSON parsing fails
                    parsed_data = {
                        "analysis": analysis,
                        "key_parties": [],
                        "important_dates": [],
                        "legal_issues": [],
                        "risk_assessment": "medium",
                        "recommended_actions": []
                    }
            except json.JSONDecodeError:
                parsed_data = {
                    "analysis": analysis,
                    "key_parties": [],
                    "important_dates": [],
                    "legal_issues": [],
                    "risk_assessment": "medium",
                    "recommended_actions": []
                }
            
            return parsed_data
        except Exception as e:
            logger.error("Document analysis failed", error=str(e))
            raise Exception(f"Document analysis failed: {str(e)}")

    async def generate_draft(self, template_name: str, data: Dict[str, Any]) -> str:
        """Generate a legal document draft."""
        try:
            prompt = f"""Generate a professional legal document based on the following template and data:

Template: {template_name}
Data: {data}

Please create a complete, properly formatted legal document. Include all necessary sections, proper formatting, and legal language appropriate for UK law."""

            draft = await self.chat(prompt, model=self.chat_model)
            return draft
        except Exception as e:
            logger.error("Draft generation failed", error=str(e))
            raise Exception(f"Draft generation failed: {str(e)}")

    async def summarize_text(self, text: str) -> str:
        """Summarize text content."""
        try:
            prompt = f"Summarize the following legal text in 3-5 clear bullet points:\n\n{text[:2000]}"
            summary = await self.chat(prompt, model=self.chat_model)
            return summary
        except Exception as e:
            logger.error("Text summarization failed", error=str(e))
            raise Exception(f"Text summarization failed: {str(e)}")

    async def health_check(self) -> bool:
        """Check if Ollama is available."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/api/tags", timeout=5.0)
                response.raise_for_status()
                return True
        except Exception as e:
            logger.error("Ollama health check failed", error=str(e))
            return False


# Global service instance
ollama_service = OllamaService()