/**
 * Healify AI - Comandos CLI
 * 
 * Integra @healify/ai-local con el CLI principal
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ==================== Tipos ====================

interface AIConfig {
  enabled: boolean
  model: string
  language: 'es' | 'en'
  autoFix: boolean
  explainSeverity: 'all' | 'high' | 'critical'
  ollamaUrl: string
}

interface SystemInfo {
  ramGB: number
  platform: string
}

interface ModelInfo {
  name: string
  minRAM: number
  size: string
  description: string
}

// ==================== Configuración ====================

const CONFIG_PATH = join(process.cwd(), 'healify.config.json')

const MODELS: ModelInfo[] = [
  { name: 'phi3:mini',    minRAM: 4,  size: '~2GB', description: 'Ultra ligero, bueno para texto simple' },
  { name: 'llama3.2:3b',  minRAM: 8,  size: '~2GB', description: 'Balanceado, recomendado para la mayoría' },
  { name: 'llama3.1:8b',  minRAM: 16, size: '~5GB', description: 'Alta calidad, mejor para tareas complejas' },
  { name: 'llama3.1:13b', minRAM: 24, size: '~8GB', description: 'Máxima calidad local' },
]

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

// ==================== Funciones del Sistema ====================

function getSystemRAM(): number {
  const os = require('os')
  return Math.floor(os.totalmem() / (1024 * 1024 * 1024))
}

function suggestModel(ramGB: number): ModelInfo {
  const availableGB = ramGB - 2
  for (let i = MODELS.length - 1; i >= 0; i--) {
    if (availableGB >= MODELS[i].minRAM) {
      return MODELS[i]
    }
  }
  return MODELS[0]
}

function checkOllamaRunning(): boolean {
  try {
    const { execSync } = require('child_process')
    execSync('curl -s http://localhost:11434/api/tags', { 
      timeout: 5000,
      stdio: 'pipe' 
    })
    return true
  } catch {
    return false
  }
}

function getInstalledModels(): Array<{ name: string }> {
  try {
    const { execSync } = require('child_process')
    const output = execSync('curl -s http://localhost:11434/api/tags', { 
      encoding: 'utf-8',
      timeout: 5000 
    })
    const data = JSON.parse(output)
    return data.models || []
  } catch {
    return []
  }
}

async function callOllamaGenerate(prompt: string, model: string): Promise<string> {
  const http = require('http')
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model,
      prompt,
      stream: false,
    })

    const req = http.request(
      'http://localhost:11434/api/generate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res: any) => {
        let body = ''
        res.on('data', (chunk: string) => (body += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(body)
            resolve(json.response)
          } catch {
            reject(new Error('Error parsing Ollama response'))
          }
        })
      }
    )

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function callOllamaChat(messages: Array<{role: string; content: string}>, model: string): Promise<string> {
  const http = require('http')
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model,
      messages,
      stream: false,
    })

    const req = http.request(
      'http://localhost:11434/api/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res: any) => {
        let body = ''
        res.on('data', (chunk: string) => (body += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(body)
            resolve(json.message?.content || '')
          } catch {
            reject(new Error('Error parsing Ollama response'))
          }
        })
      }
    )

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// ==================== Comandos ====================

export async function runAiSetup(): Promise<void> {
  console.log('\n🔧 Healify AI Setup\n')

  // 1. Verificar Ollama
  const running = checkOllamaRunning()
  if (!running) {
    console.log('❌ Ollama no está corriendo')
    console.log('\n💡 Para iniciar Ollama:')
    console.log('   cd docker && docker-compose up -d')
    console.log('\n   O si tienes Ollama instalado localmente:')
    console.log('   ollama serve')
    process.exit(1)
  }
  console.log('✅ Ollama detectado en http://localhost:11434')

  // 2. Detectar RAM
  const ram = getSystemRAM()
  const suggested = suggestModel(ram)
  console.log(`\n💾 RAM del sistema: ${ram}GB`)
  console.log(`\n🤖 Modelo sugerido: ${suggested.name}`)
  console.log(`   Tamaño: ${suggested.size}`)
  console.log(`   Descripción: ${suggested.description}`)

  // 3. Verificar modelos instalados
  const installed = getInstalledModels()
  const installedNames = installed.map(m => m.name)
  
  if (installed.length > 0) {
    console.log('\n📦 Modelos instalados:')
    installed.forEach(m => console.log(`   - ${m.name}`))
  } else {
    console.log('\n⚠️  No hay modelos instalados')
  }

  // 4. Verificar si el sugerido está instalado
  const modelBase = suggested.name.split(':')[0]
  const hasSuggested = installedNames.some(n => n.includes(modelBase))

  if (!hasSuggested) {
    console.log(`\n📥 Para descargar ${suggested.name}:`)
    console.log(`   docker exec -it healify-ollama ollama pull ${suggested.name}`)
  }

  // 5. Guardar configuración
  const config = loadConfig()
  config.ai = {
    enabled: true,
    model: suggested.name,
    language: config.ai?.language || 'es',
    autoFix: false,
    explainSeverity: 'all',
    ollamaUrl: 'http://localhost:11434',
  }
  saveConfig(config)
  console.log('\n✅ Configuración guardada en healify.config.json')
}

export async function runAiStatus(): Promise<void> {
  console.log('\n📊 Estado de Healify AI\n')

  const running = checkOllamaRunning()
  console.log(`Ollama: ${running ? '✅ Corriendo' : '❌ No disponible'}`)

  if (running) {
    const ram = getSystemRAM()
    const suggested = suggestModel(ram)
    console.log(`RAM: ${ram}GB`)
    console.log(`Modelo sugerido: ${suggested.name}`)

    const installed = getInstalledModels()
    if (installed.length > 0) {
      console.log('\nModelos instalados:')
      installed.forEach(m => console.log(`  - ${m.name}`))
    }
  }

  const config = loadConfig()
  if (config.ai) {
    console.log('\nConfiguración:')
    console.log(`  Modelo: ${config.ai.model}`)
    console.log(`  Idioma: ${config.ai.language}`)
    console.log(`  Auto-fix: ${config.ai.autoFix ? 'Sí' : 'No'}`)
  }
}

export async function runAiExplain(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log('Uso: healify ai explain <selector>')
    process.exit(1)
  }

  const selector = args[0]
  const config = loadConfig()
  const model = config.ai?.model || 'llama3.2:3b'
  const language = config.ai?.language || 'es'

  const running = checkOllamaRunning()
  if (!running) {
    console.log('❌ Ollama no está corriendo. Ejecuta: healify ai setup')
    process.exit(1)
  }

  console.log(`\n🔍 Analizando: ${selector}\n`)

  const lang = language === 'es' ? 'español' : 'inglés'
  const prompt = `Explica en ${lang} por qué este selector es frágil y cómo mejorarlo:

Selector: ${selector}

Proporciona:
1. Clasificación (TESTID, CSS, TEXT, ROLE, XPATH)
2. Nivel de confianza (0-100%)
3. Por qué es frágil
4. Selector mejorado sugerido`

  try {
    const response = await callOllamaGenerate(prompt, model)
    console.log(response)
  } catch (error) {
    console.log(`❌ Error: ${(error as Error).message}`)
    process.exit(1)
  }
}

export async function runAiChat(): Promise<void> {
  const config = loadConfig()
  const model = config.ai?.model || 'llama3.2:3b'
  const language = config.ai?.language || 'es'

  const running = checkOllamaRunning()
  if (!running) {
    console.log('❌ Ollama no está corriendo. Ejecuta: healify ai setup')
    process.exit(1)
  }

  console.log('\n💬 Chat con Healify AI (escribe "salir" para terminar)\n')

  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const history: Array<{role: string; content: string}> = []
  const lang = language === 'es' ? 'español' : 'inglés'

  const systemPrompt = `Eres un asistente experto en testing automatizado y la herramienta Healify.
Responde en ${lang}.
Sé conciso y técnico. Usa ejemplos de código cuando sea útil.`

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
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: input },
        ]
        
        const response = await callOllamaChat(messages, model)
        console.log(`\nIA: ${response}\n`)
        
        history.push({ role: 'user', content: input })
        history.push({ role: 'assistant', content: response })
        
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

  const running = checkOllamaRunning()
  if (!running) {
    console.log('❌ Ollama no está corriendo')
    process.exit(1)
  }

  const installed = getInstalledModels()
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
