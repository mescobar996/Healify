"""
Cliente para interactuar con Ollama API
"""

import json
from typing import Optional, Dict, Any, List
try:
    import requests
except ImportError:
    requests = None


class OllamaClient:
    """Cliente HTTP para Ollama"""

    def __init__(self, base_url: str = "http://localhost:11434"):
        if requests is None:
            raise ImportError(
                "El paquete 'requests' no está instalado. Ejecuta: pip install requests"
            )
        self.base_url = base_url.rstrip("/")

    def is_running(self) -> bool:
        """Verifica si Ollama está corriendo"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    def list_models(self) -> List[Dict[str, Any]]:
        """Lista modelos instalados"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return data.get("models", [])
        except Exception:
            pass
        return []

    def generate(self, prompt: str, model: Optional[str] = None) -> str:
        """Genera una respuesta usando Ollama"""
        data = {
            "model": model or "llama3.2:3b",
            "prompt": prompt,
            "stream": False,
        }
        
        response = requests.post(
            f"{self.base_url}/api/generate",
            json=data,
            timeout=120,
        )
        
        if response.status_code == 200:
            return response.json().get("response", "")
        
        raise RuntimeError(f"Error de Ollama: {response.status_code}")

    def chat(self, messages: List[Dict[str, str]], model: Optional[str] = None) -> str:
        """Chat con historial de mensajes"""
        data = {
            "model": model or "llama3.2:3b",
            "messages": messages,
            "stream": False,
        }
        
        response = requests.post(
            f"{self.base_url}/api/chat",
            json=data,
            timeout=120,
        )
        
        if response.status_code == 200:
            return response.json().get("message", {}).get("content", "")
        
        raise RuntimeError(f"Error de Ollama: {response.status_code}")

    def pull_model(self, model_name: str) -> bool:
        """Descarga un modelo"""
        try:
            response = requests.post(
                f"{self.base_url}/api/pull",
                json={"name": model_name},
                timeout=600,
            )
            return response.status_code == 200
        except Exception:
            return False
