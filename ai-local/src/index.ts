/**
 * @healify/ai-local
 * 
 * IA local para Healify usando Ollama
 * - Detecta Ollama corriendo
 * - Detecta RAM y sugiere modelo
 * - Envía contexto de healify-report.json
 * - Recibe sugerencias enriquecidas
 * - Idioma configurable
 */

import { getSystemRAM, suggestModel, checkOllamaRunning, getInstalledModels, type ModelInfo } from './detect-ram';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// ==================== Tipos ====================

export interface AIConfig {
  enabled: boolean;
  model: string;
  language: 'es' | 'en';
  autoFix: boolean;
  explainSeverity: 'all' | 'high' | 'critical';
  ollamaUrl: string;
}

export interface Suggestion {
  original: string;
  proposed: string;
  confidence: number;
  explanation: string;
  type: 'role' | 'css' | 'text' | 'xpath';
}

export interface AIResponse {
  suggestions: Suggestion[];
  summary: string;
  model: string;
  language: string;
}

// ==================== Config por Defecto ====================

const OLLAMA_REQUEST_TIMEOUT_MS = 120_000;
const MAX_CHAT_HISTORY = 20;

const DEFAULT_CONFIG: AIConfig = {
  enabled: false,
  model: 'llama3.2:3b',
  language: 'es',
  autoFix: false,
  explainSeverity: 'all',
  ollamaUrl: 'http://localhost:11434',
};

// ==================== Clase Principal ====================

export class HealifyAI {
  private config: AIConfig;
  private ollamaAvailable: boolean = false;
  private installedModels: string[] = [];

  constructor(config: Partial<AIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Inicializa y verifica la conexión con Ollama
   */
  async init(): Promise<{ success: boolean; message: string }> {
    // Verificar si Ollama está corriendo (en la URL configurada, no hardcoded)
    this.ollamaAvailable = await checkOllamaRunning(this.config.ollamaUrl);

    if (!this.ollamaAvailable) {
      return {
        success: false,
        message: `Ollama no está disponible en ${this.config.ollamaUrl}. Ejecuta: docker-compose up -d ollama`,
      };
    }

    // Obtener modelos instalados
    const models = await getInstalledModels(this.config.ollamaUrl);
    this.installedModels = models.map(m => m.name);

    // Verificar si el modelo configurado está instalado
    const modelBase = this.config.model.split(':')[0];
    const hasModel = this.installedModels.some(m => m.includes(modelBase));

    if (!hasModel) {
      const ram = getSystemRAM();
      const suggested = suggestModel(ram);
      return {
        success: false,
        message: `Modelo ${this.config.model} no instalado. Modelo sugerido: ${suggested.name}\nEjecuta: docker exec -it healify-ollama ollama pull ${suggested.name}`,
      };
    }

    return {
      success: true,
      message: `Ollama conectado. Modelo: ${this.config.model}`,
    };
  }

  /**
   * Analiza un healify-report.json y genera sugerencias enriquecidas
   */
  async analyzeReport(reportPath: string): Promise<AIResponse> {
    if (!this.ollamaAvailable) {
      throw new Error('Ollama no está disponible. Ejecuta init() primero.');
    }

    // Leer reporte
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    
    // Construir prompt
    const prompt = this.buildAnalysisPrompt(report);
    
    // Llamar a Ollama
    const response = await this.callOllama(prompt);
    
    // Parsear respuesta
    return this.parseAIResponse(response);
  }

  /**
   * Explica por qué un selector es frágil
   */
  async explainSelector(selector: string, context?: string): Promise<string> {
    if (!this.ollamaAvailable) {
      throw new Error('Ollama no está disponible.');
    }

    const prompt = this.buildExplainPrompt(selector, context);
    const response = await this.callOllama(prompt);
    return response;
  }

  /**
   * Sugiere un fix para un selector roto
   */
  async suggestFix(brokenSelector: string, domSnippet: string): Promise<Suggestion> {
    if (!this.ollamaAvailable) {
      throw new Error('Ollama no está disponible.');
    }

    const prompt = this.buildFixPrompt(brokenSelector, domSnippet);
    const response = await this.callOllama(prompt);
    
    return this.parseSuggestion(response, brokenSelector);
  }

  /**
   * Chat interactivo sobre tests
   */
  async chat(message: string, history: Array<{role: string; content: string}> = []): Promise<string> {
    if (!this.ollamaAvailable) {
      throw new Error('Ollama no está disponible.');
    }

    const systemPrompt = `Eres un asistente experto en testing automatizado y la herramienta Healify.
Responde en ${this.config.language === 'es' ? 'español' : 'inglés'}.
Sé conciso y técnico. Usa ejemplos de código cuando sea útil.`;

    const trimmedHistory = history.length > MAX_CHAT_HISTORY
      ? history.slice(history.length - MAX_CHAT_HISTORY)
      : history;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...trimmedHistory,
      { role: 'user', content: message },
    ];

    return this.callOllamaChat(messages);
  }

  // ==================== Métodos Privados ====================

  private buildAnalysisPrompt(report: any): string {
    const lang = this.config.language === 'es' ? 'español' : 'inglés';
    
    return `Analiza este reporte de Healify y proporciona sugerencias en ${lang}:

${JSON.stringify(report, null, 2)}

Para cada selector roto, explica:
1. Por qué falló
2. Cuál es el fix sugerido
3. Por qué ese fix es mejor

Sé conciso y técnico.`;
  }

  private buildExplainPrompt(selector: string, context?: string): string {
    const lang = this.config.language === 'es' ? 'español' : 'inglés';
    
    let prompt = `Explica en ${lang} por qué este selector es frágil y cómo mejorarlo:

Selector: ${selector}`;

    if (context) {
      prompt += `\n\nContexto del DOM:\n${context}`;
    }

    prompt += `\n\nProporciona:
1. Clasificación (TESTID, CSS, TEXT, ROLE, XPATH)
2. Nivel de confianza (0-100%)
3. Por qué es frágil
4. Selector mejorado sugerido`;

    return prompt;
  }

  private buildFixPrompt(brokenSelector: string, domSnippet: string): string {
    const lang = this.config.language === 'es' ? 'español' : 'inglés';
    
    return `Dado este selector roto y el DOM actual, sugiere el fix en ${lang}:

Selector roto: ${brokenSelector}

DOM actual:
${domSnippet}

Responde en formato JSON:
{
  "original": "selector original",
  "proposed": "selector propuesto",
  "confidence": 95,
  "explanation": "explicación breve",
  "type": "role|css|text|xpath"
}`;
  }

  private async callOllama(prompt: string): Promise<string> {
    return this.postToOllama('/api/generate', { model: this.config.model, prompt, stream: false }, (json) => json.response);
  }

  private async callOllamaChat(messages: Array<{role: string; content: string}>): Promise<string> {
    return this.postToOllama('/api/chat', { model: this.config.model, messages, stream: false }, (json) => json.message?.content || '');
  }

  private postToOllama(path: string, body: unknown, extract: (json: any) => string): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      const req = http.request(
        `${this.config.ollamaUrl}${path}`,
        {
          method: 'POST',
          timeout: OLLAMA_REQUEST_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            settle(() => reject(new Error(`Ollama respondió ${res.statusCode} en ${path}`)));
            return;
          }
          let responseBody = '';
          res.on('data', (chunk) => (responseBody += chunk));
          res.on('end', () => {
            settle(() => {
              try {
                resolve(extract(JSON.parse(responseBody)));
              } catch {
                reject(new Error('Error parsing Ollama response'));
              }
            });
          });
        }
      );

      req.on('timeout', () => req.destroy());
      req.on('error', (err) => settle(() => reject(err)));
      req.write(data);
      req.end();
    });
  }

  private parseAIResponse(response: string): AIResponse {
    try {
      // Intentar parsear como JSON
      const json = JSON.parse(response);
      return {
        suggestions: json.suggestions || [],
        summary: json.summary || response,
        model: this.config.model,
        language: this.config.language,
      };
    } catch {
      // Si no es JSON, devolver como texto
      return {
        suggestions: [],
        summary: response,
        model: this.config.model,
        language: this.config.language,
      };
    }
  }

  private parseSuggestion(response: string, original: string): Suggestion {
    try {
      const json = JSON.parse(response);
      return {
        original: json.original || original,
        proposed: json.proposed || original,
        confidence: json.confidence || 0,
        explanation: json.explanation || '',
        type: json.type || 'css',
      };
    } catch {
      return {
        original,
        proposed: original,
        confidence: 0,
        explanation: response,
        type: 'css',
      };
    }
  }
}

// ==================== Exportaciones ====================

export { getSystemRAM, suggestModel, checkOllamaRunning, getInstalledModels, MODELS } from './detect-ram';
export type { ModelInfo } from './detect-ram';
