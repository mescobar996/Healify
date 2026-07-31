#!/usr/bin/env node
/**
 * Healify AI - Detector de RAM y Modelo
 * Detecta la RAM del sistema y sugiere el modelo de Ollama óptimo
 */

const os = require('os');
const { execSync } = require('child_process');

// Modelos disponibles ordenados por requisitos de RAM
const MODELS = [
  { name: 'phi3:mini',    minRAM: 4,  size: '~2GB', description: 'Ultra ligero, bueno para texto simple' },
  { name: 'llama3.2:3b',  minRAM: 8,  size: '~2GB', description: 'Balanceado, recomendado para la mayoría' },
  { name: 'llama3.1:8b',  minRAM: 16, size: '~5GB', description: 'Alta calidad, mejor para tareas complejas' },
  { name: 'llama3.1:13b', minRAM: 24, size: '~8GB', description: 'Máxima calidad local' },
];

/**
 * Obtiene la RAM total del sistema en GB
 */
function getSystemRAM() {
  const totalBytes = os.totalmem();
  const totalGB = Math.floor(totalBytes / (1024 * 1024 * 1024));
  return totalGB;
}

/**
 * Sugiere el mejor modelo según la RAM disponible
 */
function suggestModel(ramGB) {
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
function checkOllamaRunning() {
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
function getInstalledModels() {
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

/**
 * Función principal
 */
function main() {
  const ram = getSystemRAM();
  const suggested = suggestModel(ram);
  const ollamaRunning = checkOllamaRunning();
  const installed = ollamaRunning ? getInstalledModels() : [];

  const result = {
    system: {
      platform: os.platform(),
      ramGB: ram,
      availableGB: ram - 2,
    },
    ollama: {
      running: ollamaRunning,
      url: ollamaRunning ? 'http://localhost:11434' : null,
    },
    suggestedModel: suggested,
    installedModels: installed.map(m => m.name),
    isModelInstalled: installed.some(m => m.name.includes(suggested.name.split(':')[0])),
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { getSystemRAM, suggestModel, checkOllamaRunning, getInstalledModels, MODELS };
