/**
 * @healify/ai-local - Detector de RAM y Modelo
 *
 * Detecta la RAM del sistema y sugiere el modelo de Ollama óptimo
 */

import * as os from 'os';
import * as http from 'http';

// ==================== Tipos ====================

export interface ModelInfo {
  name: string;
  minRAM: number;
  size: string;
  description: string;
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const REQUEST_TIMEOUT_MS = 5000;

// ==================== Modelos ====================

export const MODELS: ModelInfo[] = [
  { name: 'phi3:mini',    minRAM: 4,  size: '~2GB', description: 'Ultra ligero, bueno para texto simple' },
  { name: 'llama3.2:3b',  minRAM: 8,  size: '~2GB', description: 'Balanceado, recomendado para la mayoría' },
  { name: 'llama3.1:8b',  minRAM: 16, size: '~5GB', description: 'Alta calidad, mejor para tareas complejas' },
  { name: 'llama3.1:13b', minRAM: 24, size: '~8GB', description: 'Máxima calidad local' },
];

// ==================== Funciones ====================

/**
 * Obtiene la RAM total del sistema en GB
 */
export function getSystemRAM(): number {
  const totalBytes = os.totalmem();
  const totalGB = Math.floor(totalBytes / (1024 * 1024 * 1024));
  return totalGB;
}

/**
 * Sugiere el mejor modelo según la RAM disponible
 */
export function suggestModel(ramGB: number): ModelInfo {
  // Dejar 2GB para el sistema operativo
  const availableGB = ramGB - 2;

  for (let i = MODELS.length - 1; i >= 0; i--) {
    if (availableGB >= MODELS[i].minRAM) {
      return MODELS[i];
    }
  }
  return MODELS[0]; // Default al más ligero
}

/**
 * Hace GET a /api/tags contra la URL de Ollama dada, con timeout real.
 * Devuelve null si no responde, no da 200, o el body no es JSON válido.
 */
function fetchTags(ollamaUrl: string): Promise<{ models?: Array<{ name: string; size: number }> } | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: { models?: Array<{ name: string; size: number }> } | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const req = http.get(`${ollamaUrl}/api/tags`, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        finish(null);
        return;
      }
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          finish(JSON.parse(body));
        } catch {
          finish(null);
        }
      });
    });

    req.on('timeout', () => req.destroy());
    req.on('error', () => finish(null));
  });
}

/**
 * Verifica si Ollama está corriendo en la URL configurada (default localhost:11434)
 */
export async function checkOllamaRunning(ollamaUrl: string = DEFAULT_OLLAMA_URL): Promise<boolean> {
  const data = await fetchTags(ollamaUrl);
  return data !== null;
}

/**
 * Lista modelos instalados en Ollama en la URL configurada
 */
export async function getInstalledModels(ollamaUrl: string = DEFAULT_OLLAMA_URL): Promise<Array<{ name: string; size: number }>> {
  const data = await fetchTags(ollamaUrl);
  return data?.models || [];
}
