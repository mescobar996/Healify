"""
@healify/ai-local - Python SDK
IA local para Healify usando Ollama
"""

import json
import os
from typing import Optional, Dict, Any, List
from .ollama import OllamaClient
from .detector import SystemDetector, ModelInfo


class HealifyAI:
    """Clase principal para interactuar con IA local de Healify"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Inicializa HealifyAI
        
        Args:
            config: Configuración opcional. Si no se provee, intenta cargar de healify.config.json
        """
        self.config = config or self._load_config()
        self.ollama = OllamaClient(self.config.get("ollamaUrl", "http://localhost:11434"))
        self.detector = SystemDetector()
        self._ollama_available = False

    def _load_config(self) -> Dict[str, Any]:
        """Carga configuración de healify.config.json"""
        config_path = os.path.join(os.getcwd(), "healify.config.json")
        default_config = {
            "enabled": False,
            "model": "llama3.2:3b",
            "language": "es",
            "ollamaUrl": "http://localhost:11434",
        }
        
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                return {**default_config, **loaded.get("ai", {})}
        
        return default_config

    def init(self) -> Dict[str, Any]:
        """
        Inicializa y verifica la conexión con Ollama
        
        Returns:
            Dict con success y message
        """
        self._ollama_available = self.ollama.is_running()
        
        if not self._ollama_available:
            return {
                "success": False,
                "message": "Ollama no está corriendo. Ejecuta: docker-compose up -d ollama"
            }

        # Verificar modelo
        installed = self.ollama.list_models()
        installed_names = [m["name"] for m in installed]
        model_base = self.config["model"].split(":")[0]
        
        if not any(model_base in name for name in installed_names):
            ram = self.detector.get_ram_gb()
            suggested = self.detector.suggest_model(ram)
            return {
                "success": False,
                "message": f"Modelo {self.config['model']} no instalado. "
                          f"Modelo sugerido: {suggested.name}\n"
                          f"Ejecuta: docker exec -it healify-ollama ollama pull {suggested.name}"
            }

        return {
            "success": True,
            "message": f"Ollama conectado. Modelo: {self.config['model']}"
        }

    def analyze_report(self, report_path: str) -> Dict[str, Any]:
        """
        Analiza un healify-report.json y genera sugerencias enriquecidas
        
        Args:
            report_path: Ruta al archivo healify-report.json
            
        Returns:
            Dict con suggestions y summary
        """
        if not self._ollama_available:
            raise RuntimeError("Ollama no está disponible. Ejecuta init() primero.")

        with open(report_path, "r", encoding="utf-8") as f:
            report = json.load(f)

        prompt = self._build_analysis_prompt(report)
        response = self.ollama.generate(prompt)
        
        return self._parse_response(response)

    def explain_selector(self, selector: str, context: Optional[str] = None) -> str:
        """
        Explica por qué un selector es frágil
        
        Args:
            selector: Selector a analizar
            context: Contexto del DOM opcional
            
        Returns:
            Explicación en texto
        """
        if not self._ollama_available:
            raise RuntimeError("Ollama no está disponible.")

        prompt = self._build_explain_prompt(selector, context)
        return self.ollama.generate(prompt)

    def suggest_fix(self, broken_selector: str, dom_snippet: str) -> Dict[str, Any]:
        """
        Sugiere un fix para un selector roto
        
        Args:
            broken_selector: Selector que falló
            dom_snippet: Fragmento del DOM actual
            
        Returns:
            Dict con original, proposed, confidence, explanation, type
        """
        if not self._ollama_available:
            raise RuntimeError("Ollama no está disponible.")

        prompt = self._build_fix_prompt(broken_selector, dom_snippet)
        response = self.ollama.generate(prompt)
        
        return self._parse_suggestion(response, broken_selector)

    def chat(self, message: str, history: Optional[List[Dict[str, str]]] = None) -> str:
        """
        Chat interactivo sobre tests
        
        Args:
            message: Mensaje del usuario
            history: Historial de conversación
            
        Returns:
            Respuesta de la IA
        """
        if not self._ollama_available:
            raise RuntimeError("Ollama no está disponible.")

        lang = "español" if self.config.get("language") == "es" else "inglés"
        
        system_prompt = (
            f"Eres un asistente experto en testing automatizado y la herramienta Healify.\n"
            f"Responde en {lang}.\n"
            f"Sé conciso y técnico. Usa ejemplos de código cuando sea útil."
        )

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": message})

        return self.ollama.chat(messages)

    # ==================== Métodos Privados ====================

    def _build_analysis_prompt(self, report: Dict) -> str:
        lang = "español" if self.config.get("language") == "es" else "inglés"
        return (
            f"Analiza este reporte de Healify y proporciona sugerencias en {lang}:\n\n"
            f"{json.dumps(report, indent=2, ensure_ascii=False)}\n\n"
            f"Para cada selector roto, explica:\n"
            f"1. Por qué falló\n"
            f"2. Cuál es el fix sugerido\n"
            f"3. Por qué ese fix es mejor\n\n"
            f"Sé conciso y técnico."
        )

    def _build_explain_prompt(self, selector: str, context: Optional[str]) -> str:
        lang = "español" if self.config.get("language") == "es" else "inglés"
        prompt = (
            f"Explica en {lang} por qué este selector es frágil y cómo mejorarlo:\n\n"
            f"Selector: {selector}"
        )
        if context:
            prompt += f"\n\nContexto del DOM:\n{context}"
        prompt += (
            f"\n\nProporciona:\n"
            f"1. Clasificación (TESTID, CSS, TEXT, ROLE, XPATH)\n"
            f"2. Nivel de confianza (0-100%)\n"
            f"3. Por qué es frágil\n"
            f"4. Selector mejorado sugerido"
        )
        return prompt

    def _build_fix_prompt(self, broken_selector: str, dom_snippet: str) -> str:
        lang = "español" if self.config.get("language") == "es" else "inglés"
        return (
            f"Dado este selector roto y el DOM actual, sugiere el fix en {lang}:\n\n"
            f"Selector roto: {broken_selector}\n\n"
            f"DOM actual:\n{dom_snippet}\n\n"
            f"Responde en formato JSON:\n"
            f'{{"original": "selector original", "proposed": "selector propuesto", '
            f'"confidence": 95, "explanation": "explicación breve", '
            f'"type": "role|css|text|xpath"}}'
        )

    def _parse_response(self, response: str) -> Dict[str, Any]:
        try:
            data = json.loads(response)
            return {
                "suggestions": data.get("suggestions", []),
                "summary": data.get("summary", response),
                "model": self.config["model"],
                "language": self.config.get("language", "es"),
            }
        except json.JSONDecodeError:
            return {
                "suggestions": [],
                "summary": response,
                "model": self.config["model"],
                "language": self.config.get("language", "es"),
            }

    def _parse_suggestion(self, response: str, original: str) -> Dict[str, Any]:
        try:
            data = json.loads(response)
            return {
                "original": data.get("original", original),
                "proposed": data.get("proposed", original),
                "confidence": data.get("confidence", 0),
                "explanation": data.get("explanation", ""),
                "type": data.get("type", "css"),
            }
        except json.JSONDecodeError:
            return {
                "original": original,
                "proposed": original,
                "confidence": 0,
                "explanation": response,
                "type": "css",
            }
