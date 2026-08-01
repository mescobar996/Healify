/**
 * Healify AI - Comandos CLI
 *
 * Integra @healify/ai-local con el CLI principal (sin reimplementar su lógica)
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  HealifyAI,
  getSystemRAM,
  suggestModel,
  checkOllamaRunning,
  getInstalledModels,
  MODELS,
} from '@healify/ai-local'

// ==================== Configuración ====================

const CONFIG_PATH = join(process.cwd(), 'healify.config.json')
const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

function loadConfig(): Record<string, any> {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch {}
  return {}
}

function saveConfig(config: Record<string, any>): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
}

// ==================== Comandos ====================

export async function runAiSetup(): Promise<void> {
  console.log('\n🔧 Healify AI Setup\n')

  const config = loadConfig()
  const ollamaUrl = config.ai?.ollamaUrl || DEFAULT_OLLAMA_URL

  const running = await checkOllamaRunning(ollamaUrl)
  if (!running) {
    console.log(`❌ Ollama no está disponible en ${ollamaUrl}`)
    console.log('\n💡 Para iniciar Ollama:')
    console.log('   cd docker && docker-compose up -d')
    console.log('\n   O si tienes Ollama instalado localmente:')
    console.log('   ollama serve')
    process.exit(1)
  }
  console.log(`✅ Ollama detectado en ${ollamaUrl}`)

  const ram = getSystemRAM()
  const suggested = suggestModel(ram)
  console.log(`\n💾 RAM del sistema: ${ram}GB`)
  console.log(`\n🤖 Modelo sugerido: ${suggested.name}`)
  console.log(`   Tamaño: ${suggested.size}`)
  console.log(`   Descripción: ${suggested.description}`)

  const installed = await getInstalledModels(ollamaUrl)
  const installedNames = installed.map(m => m.name)

  if (installed.length > 0) {
    console.log('\n📦 Modelos instalados:')
    installed.forEach(m => console.log(`   - ${m.name}`))
  } else {
    console.log('\n⚠️  No hay modelos instalados')
  }

  const modelBase = suggested.name.split(':')[0]
  const hasSuggested = installedNames.some(n => n.includes(modelBase))

  if (!hasSuggested) {
    console.log(`\n📥 Para descargar ${suggested.name}:`)
    console.log(`   docker exec -it healify-ollama ollama pull ${suggested.name}`)
  }

  config.ai = {
    enabled: true,
    model: suggested.name,
    language: config.ai?.language || 'es',
    ollamaUrl,
  }
  saveConfig(config)
  console.log('\n✅ Configuración guardada en healify.config.json')
}

export async function runAiStatus(): Promise<void> {
  console.log('\n📊 Estado de Healify AI\n')

  const config = loadConfig()
  const ollamaUrl = config.ai?.ollamaUrl || DEFAULT_OLLAMA_URL
  const running = await checkOllamaRunning(ollamaUrl)
  console.log(`Ollama: ${running ? '✅ Corriendo' : '❌ No disponible'} (${ollamaUrl})`)

  if (running) {
    const ram = getSystemRAM()
    const suggested = suggestModel(ram)
    console.log(`RAM: ${ram}GB`)
    console.log(`Modelo sugerido: ${suggested.name}`)

    const installed = await getInstalledModels(ollamaUrl)
    if (installed.length > 0) {
      console.log('\nModelos instalados:')
      installed.forEach(m => console.log(`  - ${m.name}`))
    }
  }

  if (config.ai) {
    console.log('\nConfiguración:')
    console.log(`  Modelo: ${config.ai.model}`)
    console.log(`  Idioma: ${config.ai.language}`)
  }
}

export async function runAiExplain(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Uso: healify ai explain <selector>')
    process.exit(1)
  }

  const selector = args[0]
  const config = loadConfig()
  const ai = new HealifyAI(config.ai)

  const result = await ai.init()
  if (!result.success) {
    console.log(`❌ ${result.message}`)
    process.exit(1)
  }

  console.log(`\n🔍 Analizando: ${selector}\n`)

  try {
    const explanation = await ai.explainSelector(selector)
    console.log(explanation)
  } catch (error) {
    console.log(`❌ Error: ${(error as Error).message}`)
    process.exit(1)
  }
}

export async function runAiChat(): Promise<void> {
  const config = loadConfig()
  const ai = new HealifyAI(config.ai)

  const result = await ai.init()
  if (!result.success) {
    console.log(`❌ ${result.message}`)
    process.exit(1)
  }

  console.log('\n💬 Chat con Healify AI (escribe "salir" para terminar)\n')

  const readline = require('node:readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const history: Array<{ role: string; content: string }> = []

  const askQuestion = () => {
    rl.question('Tú: ', async (input: string) => {
      if (input.toLowerCase() === 'salir' || input.toLowerCase() === 'exit') {
        console.log('\n👋 ¡Hasta luego!')
        rl.close()
        process.exit(0)
      }

      if (!input.trim()) {
        askQuestion()
        return
      }

      try {
        const response = await ai.chat(input, history)
        console.log(`\nIA: ${response}\n`)

        // HealifyAI.chat() ya trunca el historial que manda a Ollama; acá
        // mantenemos el registro local acotado para no crecer sin límite.
        history.push({ role: 'user', content: input })
        history.push({ role: 'assistant', content: response })
        if (history.length > 40) {
          history.splice(0, history.length - 40)
        }

        askQuestion()
      } catch (error) {
        console.log(`\n❌ Error: ${(error as Error).message}\n`)
        askQuestion()
      }
    })
  }

  askQuestion()
}

export async function runAiModels(): Promise<void> {
  console.log('\n📦 Modelos de Ollama\n')

  const config = loadConfig()
  const ollamaUrl = config.ai?.ollamaUrl || DEFAULT_OLLAMA_URL
  const running = await checkOllamaRunning(ollamaUrl)
  if (!running) {
    console.log('❌ Ollama no está corriendo')
    process.exit(1)
  }

  const installed = await getInstalledModels(ollamaUrl)
  const ram = getSystemRAM()

  console.log(`RAM del sistema: ${ram}GB\n`)

  if (installed.length > 0) {
    console.log('Instalados:')
    installed.forEach(m => console.log(`  ✅ ${m.name}`))
  }

  console.log('\nModelos recomendados:')
  MODELS.forEach(m => {
    const icon = ram >= m.minRAM + 2 ? '✅' : '❌'
    console.log(`  ${icon} ${m.name} (${m.size}) - ${m.description}`)
  })
}
