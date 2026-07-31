/**
 * @healify/ai-local - Detector de RAM y Modelo
 * 
 * Detecta la RAM del sistema y sugiere el modelo de Ollama óptimo
 */

import * as os from 'os';
import { execSync } from 'child_process';

// ==================== Tipos ====================

export interface ModelInfo {
  name: string;
  minRAM: number;
  size: string;
  description: string;
}

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
 * Verifica si Ollama está corriendo
 */
export function checkOllamaRunning(): boolean {
  try {
    execSync('curl -s http://localhost:11434/api/tags', { 
      timeout: 5000,
      stdio: 'pipe' 
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Lista modelos instalados en Ollama
 */
export function getInstalledModels(): Array<{ name: string; size: number }> {
  try {
    const output = execSync('curl -s http://localhost:11434/api/tags', { 
      encoding: 'utf-8',
      timeout: 5000 
    });
    const data = JSON.parse(output);
    return data.models || [];
  } catch {
    return [];
  }
}
