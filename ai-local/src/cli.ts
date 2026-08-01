#!/usr/bin/env node
/**
 * @healify/ai-local CLI
 * 
 * Comandos:
 *   healify-ai setup     - Configura IA local
 *   healify-ai status    - Muestra estado de Ollama
 *   healify-ai explain   - Explica un selector
 *   healify-ai fix       - Sugiere fix para selector roto
 *   healify-ai chat      - Chat interactivo
 *   healify-ai models    - Lista modelos disponibles
 */

import { HealifyAI, getSystemRAM, suggestModel, checkOllamaRunning, getInstalledModels } from './index';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ==================== Config ====================

const CONFIG_PATH = path.join(process.cwd(), 'healify.config.json');

function loadConfig(): any {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveConfig(config: any): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

// ==================== Comandos ====================

async function cmdSetup(): Promise<void> {
  console.log('\n🔧 Healify AI Setup\n');

  const config = loadConfig();
  const ollamaUrl = config.ai?.ollamaUrl || 'http://localhost:11434';

  // 1. Verificar Ollama
  const running = await checkOllamaRunning(ollamaUrl);
  if (!running) {
    console.log('❌ Ollama no está corriendo');
    console.log('\n💡 Para iniciar Ollama:');
    console.log('   cd docker && docker-compose up -d');
    console.log('\n   O si tienes Ollama instalado localmente:');
    console.log('   ollama serve');
    process.exit(1);
  }
  console.log(`✅ Ollama detectado en ${ollamaUrl}`);

  // 2. Detectar RAM
  const ram = getSystemRAM();
  const suggested = suggestModel(ram);
  console.log(`\n💾 RAM del sistema: ${ram}GB`);
  console.log(`\n🤖 Modelo sugerido: ${suggested.name}`);
  console.log(`   Tamaño: ${suggested.size}`);
  console.log(`   Descripción: ${suggested.description}`);

  // 3. Verificar modelos instalados
  const installed = await getInstalledModels(ollamaUrl);
  const installedNames = installed.map(m => m.name);

  if (installed.length > 0) {
    console.log('\n📦 Modelos instalados:');
    installed.forEach(m => console.log(`   - ${m.name}`));
  } else {
    console.log('\n⚠️  No hay modelos instalados');
  }

  // 4. Verificar si el sugerido está instalado
  const modelBase = suggested.name.split(':')[0];
  const hasSuggested = installedNames.some(n => n.includes(modelBase));

  if (!hasSuggested) {
    console.log(`\n📥 Para descargar ${suggested.name}:`);
    console.log(`   docker exec -it healify-ollama ollama pull ${suggested.name}`);
  }

  // 5. Guardar configuración
  config.ai = {
    enabled: true,
    model: suggested.name,
    language: config.ai?.language || 'es',
    ollamaUrl,
  };
  saveConfig(config);
  console.log('\n✅ Configuración guardada en healify.config.json');
}

async function cmdStatus(): Promise<void> {
  console.log('\n📊 Estado de Healify AI\n');

  const config = loadConfig();
  const ollamaUrl = config.ai?.ollamaUrl || 'http://localhost:11434';
  const running = await checkOllamaRunning(ollamaUrl);
  console.log(`Ollama: ${running ? '✅ Corriendo' : '❌ No disponible'}`);

  if (running) {
    const ram = getSystemRAM();
    const suggested = suggestModel(ram);
    console.log(`RAM: ${ram}GB`);
    console.log(`Modelo sugerido: ${suggested.name}`);

    const installed = await getInstalledModels(ollamaUrl);
    if (installed.length > 0) {
      console.log('\nModelos instalados:');
      installed.forEach(m => console.log(`  - ${m.name}`));
    }
  }

  if (config.ai) {
    console.log('\nConfiguración:');
    console.log(`  Modelo: ${config.ai.model}`);
    console.log(`  Idioma: ${config.ai.language}`);
  }
}

async function cmdExplain(selector: string): Promise<void> {
  const config = loadConfig();
  const ai = new HealifyAI(config.ai);

  const result = await ai.init();
  if (!result.success) {
    console.log(`❌ ${result.message}`);
    process.exit(1);
  }

  console.log(`\n🔍 Analizando: ${selector}\n`);
  const explanation = await ai.explainSelector(selector);
  console.log(explanation);
}

async function cmdFix(selector: string, dom: string): Promise<void> {
  const config = loadConfig();
  const ai = new HealifyAI(config.ai);

  const result = await ai.init();
  if (!result.success) {
    console.log(`❌ ${result.message}`);
    process.exit(1);
  }

  console.log(`\n🔧 Buscando fix para: ${selector}\n`);
  const suggestion = await ai.suggestFix(selector, dom);
  
  console.log('Original:', suggestion.original);
  console.log('Propuesto:', suggestion.proposed);
  console.log('Confianza:', suggestion.confidence + '%');
  console.log('Explicación:', suggestion.explanation);
}

async function cmdChat(): Promise<void> {
  const config = loadConfig();
  const ai = new HealifyAI(config.ai);

  const result = await ai.init();
  if (!result.success) {
    console.log(`❌ ${result.message}`);
    process.exit(1);
  }

  console.log('\n💬 Chat con Healify AI (escribe "salir" para terminar)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const history: Array<{role: string; content: string}> = [];

  const askQuestion = () => {
    rl.question('Tú: ', async (input) => {
      if (input.toLowerCase() === 'salir' || input.toLowerCase() === 'exit') {
        console.log('\n👋 ¡Hasta luego!');
        rl.close();
        process.exit(0);
      }

      try {
        const response = await ai.chat(input, history);
        console.log(`\nIA: ${response}\n`);
        
        history.push({ role: 'user', content: input });
        history.push({ role: 'assistant', content: response });
        
        askQuestion();
      } catch (error) {
        console.log(`\n❌ Error: ${(error as Error).message}\n`);
        askQuestion();
      }
    });
  };

  askQuestion();
}

async function cmdModels(): Promise<void> {
  console.log('\n📦 Modelos de Ollama\n');

  const config = loadConfig();
  const ollamaUrl = config.ai?.ollamaUrl || 'http://localhost:11434';
  const running = await checkOllamaRunning(ollamaUrl);
  if (!running) {
    console.log('❌ Ollama no está corriendo');
    process.exit(1);
  }

  const installed = await getInstalledModels(ollamaUrl);
  const ram = getSystemRAM();

  console.log(`RAM del sistema: ${ram}GB\n`);

  if (installed.length > 0) {
    console.log('Instalados:');
    installed.forEach(m => console.log(`  ✅ ${m.name}`));
  }

  console.log('\nModelos recomendados:');
  const { MODELS } = await import('./index');
  MODELS.forEach(m => {
    const icon = ram >= m.minRAM + 2 ? '✅' : '❌';
    console.log(`  ${icon} ${m.name} (${m.size}) - ${m.description}`);
  });
}

// ==================== Main ====================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'setup':
      await cmdSetup();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'explain':
      if (!args[1]) {
        console.log('Uso: healify-ai explain <selector>');
        process.exit(1);
      }
      await cmdExplain(args[1]);
      break;
    case 'fix':
      if (!args[1] || !args[2]) {
        console.log('Uso: healify-ai fix <selector> <dom>');
        process.exit(1);
      }
      await cmdFix(args[1], args[2]);
      break;
    case 'chat':
      await cmdChat();
      break;
    case 'models':
      await cmdModels();
      break;
    default:
      console.log(`
Healify AI - IA Local para Testing

Comandos:
  setup      Configura IA local
  status     Muestra estado de Ollama
  explain    Explica un selector
  fix        Sugiere fix para selector roto
  chat       Chat interactivo
  models     Lista modelos disponibles

Ejemplo:
  healify-ai setup
  healify-ai explain "[data-testid='btn']"
  healify-ai chat
`);
  }
}

main().catch(console.error);
