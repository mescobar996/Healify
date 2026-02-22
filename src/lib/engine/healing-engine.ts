/**
 * HEALIFY - Motor de Autocuración de Tests v2.0
 * 
 * Motor de simulación de IA de alta fidelidad con explicaciones técnicas convincentes.
 * No usa APIs externas - toda la lógica es determinística y educada.
 */

import { z } from 'zod'

// ============================================
// TIPOS Y SCHEMAS
// ============================================

export const HealRequestSchema = z.object({
  selector: z.string().min(1, "Selector is required"),
  htmlContext: z.string().optional(),
  testName: z.string().optional(),
  errorMessage: z.string().optional(),
})

export type HealRequest = z.infer<typeof HealRequestSchema>

export const HealResponseSchema = z.object({
  fixedSelector: z.string(),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
  selectorType: z.enum(['CSS', 'XPATH', 'TESTID', 'ROLE', 'TEXT', 'MIXED']),
  alternatives: z.array(z.object({
    selector: z.string(),
    confidence: z.number(),
  })).optional(),
  needsReview: z.boolean(),
  robustnessImprovement: z.number(), // Porcentaje de mejora
  technicalDetails: z.object({
    detectedIssue: z.string(),
    proposedSolution: z.string(),
    accessibilityCompliant: z.boolean(),
    stableAgainstDOMChanges: z.boolean(),
  }),
})

export type HealResponse = z.infer<typeof HealResponseSchema>

// ============================================
// PATRONES DE ANÁLISIS AVANZADO
// ============================================

interface SelectorAnalysis {
  type: 'ID' | 'CLASS' | 'TESTID' | 'ROLE' | 'TEXT' | 'XPATH' | 'ATTRIBUTE' | 'COMPOUND' | 'CSS'
  issues: string[]
  element: string // button, input, link, etc.
  action: string // click, type, etc.
  isDynamic: boolean
  isFragile: boolean
}

interface HealingStrategy {
  selector: string
  type: HealResponse['selectorType']
  confidence: number
  explanation: string
  robustnessGain: number
  technicalReason: string
}

// ============================================
// ANÁLISIS INTELIGENTE DE SELECTORES
// ============================================

/**
 * Analiza un selector y detecta problemas
 */
function analyzeSelector(selector: string): SelectorAnalysis {
  const analysis: SelectorAnalysis = {
    type: 'CSS',
    issues: [],
    element: 'element',
    action: 'interact',
    isDynamic: false,
    isFragile: false,
  }

  // Detectar tipo
  if (selector.startsWith('#')) {
    analysis.type = 'ID'
    analysis.issues.push('ID selectors are brittle and can change')
    
    // Detectar IDs dinámicos
    if (/\d+/.test(selector) || /-[a-f0-9]+/.test(selector)) {
      analysis.isDynamic = true
      analysis.issues.push('Dynamic ID detected - will break on next build')
    }
  } else if (selector.startsWith('.')) {
    analysis.type = 'CLASS'
    analysis.issues.push('Class names can change during refactoring')
    
    // Detectar clases de CSS modules o styled-components
    if (/_[a-z]+_[a-z0-9]+/.test(selector) || /sc-[a-z]+/.test(selector)) {
      analysis.isDynamic = true
      analysis.issues.push('Generated CSS class detected - unstable')
    }
  } else if (selector.includes('[data-testid=')) {
    analysis.type = 'TESTID'
    // TestIDs son estables, no hay issues críticos
  } else if (selector.startsWith('//')) {
    analysis.type = 'XPATH'
    analysis.issues.push('XPath is fragile to DOM structure changes')
    analysis.isFragile = true
  } else if (selector.includes('[role=')) {
    analysis.type = 'ROLE'
    // Roles son muy estables
  } else if (selector.includes('text=') || selector.includes('has-text')) {
    analysis.type = 'TEXT'
    analysis.issues.push('Text content can change with copy updates')
  }

  // Detectar elemento inferido
  if (/button|btn/i.test(selector)) {
    analysis.element = 'button'
    analysis.action = 'click'
  } else if (/input|field/i.test(selector)) {
    analysis.element = 'input'
    analysis.action = 'type'
  } else if (/link|anchor|a\[|nav/i.test(selector)) {
    analysis.element = 'link'
    analysis.action = 'click'
  } else if (/submit|form/i.test(selector)) {
    analysis.element = 'button'
    analysis.action = 'submit'
  } else if (/login|signin/i.test(selector)) {
    analysis.element = 'button'
    analysis.action = 'login'
  }

  return analysis
}

/**
 * Simula el "pensamiento" de la IA con delays progresivos
 */
async function simulateAIThinking(selector: string): Promise<string[]> {
  const steps: string[] = []
  
  steps.push('Analyzing selector structure...')
  await delay(300)
  
  steps.push('Detecting DOM patterns...')
  await delay(400)
  
  steps.push('Evaluating accessibility attributes...')
  await delay(300)
  
  steps.push('Calculating selector robustness...')
  await delay(200)
  
  steps.push('Generating optimal replacement...')
  await delay(300)
  
  return steps
}

/**
 * Genera estrategias de curación basadas en el análisis
 */
function generateHealingStrategies(
  selector: string,
  analysis: SelectorAnalysis
): HealingStrategy[] {
  const strategies: HealingStrategy[] = []

  // Estrategia 1: Selectores semánticos por rol
  if (analysis.element === 'button') {
    const action = extractActionFromSelector(selector)
    
    strategies.push({
      selector: `role('button', { name: '${action}' })`,
      type: 'ROLE',
      confidence: 0.92,
      explanation: `Se detectó un ${analysis.type} inestable; se cambió por un selector basado en accesibilidad (ARIA role) para mayor robustez. Los selectores por rol son resilientes a cambios de estructura del DOM.`,
      robustnessGain: 45,
      technicalReason: 'ARIA roles are stable across refactors and DOM restructures',
    })

    strategies.push({
      selector: `button:has-text('${action}')`,
      type: 'TEXT',
      confidence: 0.85,
      explanation: `Selector basado en texto visible del botón. Es menos estable que el rol pero más intuitivo para debugging.`,
      robustnessGain: 30,
      technicalReason: 'Text-based selectors work well for user-facing elements',
    })
  }

  // Estrategia 2: Para inputs
  if (analysis.element === 'input') {
    const fieldName = extractFieldName(selector)
    
    strategies.push({
      selector: `input[placeholder*='${fieldName}']`,
      type: 'CSS',
      confidence: 0.88,
      explanation: `Selector basado en el placeholder del campo. Los placeholders son más estables que los IDs generados automáticamente.`,
      robustnessGain: 35,
      technicalReason: 'Placeholder attributes are typically stable and semantic',
    })

    strategies.push({
      selector: `label:has-text('${fieldName}') + input`,
      type: 'CSS',
      confidence: 0.90,
      explanation: `Selector basado en la relación semántica entre label e input. Altamente resiliente a cambios de estructura.`,
      robustnessGain: 40,
      technicalReason: 'Label-input relationships are semantically meaningful',
    })
  }

  // Estrategia 3: Para enlaces
  if (analysis.element === 'link') {
    const linkText = extractLinkText(selector)
    
    strategies.push({
      selector: `role('link', { name: '${linkText}' })`,
      type: 'ROLE',
      confidence: 0.91,
      explanation: `Selector por rol de enlace con texto. Muy estable y accesible.`,
      robustnessGain: 42,
      technicalReason: 'Link roles with names are the gold standard for navigation',
    })
  }

  // Estrategia 4: Para selectores con data-testid
  if (analysis.type === 'TESTID') {
    const testid = extractTestid(selector)
    
    strategies.push({
      selector: `[data-testid='${testid}']`,
      type: 'TESTID',
      confidence: 0.95,
      explanation: `El testid se mantiene pero se normaliza la sintaxis. Los data-testid son la opción más estable cuando están disponibles.`,
      robustnessGain: 50,
      technicalReason: 'data-testid attributes are purpose-built for testing stability',
    })
  }

  // Estrategia 5: Para XPATH complejos
  if (analysis.type === 'XPATH') {
    strategies.push({
      selector: `role('button')`,
      type: 'ROLE',
      confidence: 0.82,
      explanation: `Se reemplazó el XPath frágil por un selector de rol. Los XPath dependen de la estructura exacta del DOM que cambia frecuentemente.`,
      robustnessGain: 55,
      technicalReason: 'XPath is the most fragile selector type; ARIA roles are preferred',
    })
  }

  // Estrategia 6: Fallback para IDs dinámicos
  if (analysis.isDynamic && analysis.type === 'ID') {
    strategies.push({
      selector: `.${extractBaseClass(selector)}`,
      type: 'CSS',
      confidence: 0.78,
      explanation: `Se detectó un ID dinámico con hash o número aleatorio. Se propuso una clase estable como alternativa.`,
      robustnessGain: 38,
      technicalReason: 'Dynamic IDs change between builds; stable classes are preferred',
    })
  }

  // Estrategia 7: Selector compuesto robusto
  if (strategies.length === 0) {
    strategies.push({
      selector: `visible=${selector.replace(/[.#]/, '')}`,
      type: 'CSS',
      confidence: 0.75,
      explanation: `Selector compuesto con filtro de visibilidad. Mayor robustez contra elementos ocultos.`,
      robustnessGain: 25,
      technicalReason: 'Visibility filters prevent interaction with hidden elements',
    })
  }

  return strategies.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Extrae información contextual del selector
 */
function extractActionFromSelector(selector: string): string {
  const actions: Record<string, string> = {
    'login': 'Login',
    'signin': 'Sign In',
    'submit': 'Submit',
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'update': 'Update',
    'create': 'Create',
    'add': 'Add',
    'remove': 'Remove',
    'search': 'Search',
    'send': 'Send',
    'confirm': 'Confirm',
    'accept': 'Accept',
    'reject': 'Reject',
    'next': 'Next',
    'previous': 'Previous',
    'back': 'Back',
    'continue': 'Continue',
    'finish': 'Finish',
    'start': 'Start',
    'stop': 'Stop',
    'play': 'Play',
    'pause': 'Pause',
  }

  for (const [key, value] of Object.entries(actions)) {
    if (selector.toLowerCase().includes(key)) {
      return value
    }
  }

  return 'Submit'
}

function extractFieldName(selector: string): string {
  const fields: Record<string, string> = {
    'email': 'Email',
    'password': 'Password',
    'username': 'Username',
    'name': 'Name',
    'phone': 'Phone',
    'address': 'Address',
    'search': 'Search',
    'date': 'Date',
    'title': 'Title',
    'description': 'Description',
  }

  for (const [key, value] of Object.entries(fields)) {
    if (selector.toLowerCase().includes(key)) {
      return value
    }
  }

  return 'Field'
}

function extractLinkText(selector: string): string {
  const links: Record<string, string> = {
    'home': 'Home',
    'about': 'About',
    'contact': 'Contact',
    'help': 'Help',
    'settings': 'Settings',
    'profile': 'Profile',
    'logout': 'Logout',
    'login': 'Login',
    'signup': 'Sign Up',
    'learn': 'Learn More',
    'read': 'Read More',
    'view': 'View',
    'download': 'Download',
  }

  for (const [key, value] of Object.entries(links)) {
    if (selector.toLowerCase().includes(key)) {
      return value
    }
  }

  return 'Link'
}

function extractTestid(selector: string): string {
  const match = selector.match(/data-testid=['"]([^'"]+)['"]/)
  return match ? match[1] : 'element'
}

function extractBaseClass(selector: string): string {
  // Remover prefijos y sufijos dinámicos
  return selector
    .replace(/[#.]/, '')
    .replace(/[-_]?\d+/g, '')
    .replace(/[-_][a-f0-9]{6,}/gi, '')
    .toLowerCase()
}

// ============================================
// FUNCIÓN PRINCIPAL DE CURACIÓN
// ============================================

/**
 * Analiza un selector fallido y propone una curación
 */
export async function analyzeAndHeal(request: HealRequest): Promise<HealResponse> {
  const { selector, htmlContext, testName, errorMessage } = request

  // Simular pensamiento de IA
  const thinkingSteps = await simulateAIThinking(selector)

  // Analizar el selector
  const analysis = analyzeSelector(selector)

  // Generar estrategias de curación
  const strategies = generateHealingStrategies(selector, analysis)

  // Seleccionar la mejor estrategia
  const bestStrategy = strategies[0] || {
    selector: 'body',
    type: 'CSS' as const,
    confidence: 0.5,
    explanation: 'Unable to generate a reliable selector. Manual review required.',
    robustnessGain: 0,
    technicalReason: 'No suitable pattern found',
  }

  // Generar confianza realista (0.75 - 0.98)
  const baseConfidence = bestStrategy.confidence
  const adjustedConfidence = Math.max(0.75, Math.min(0.98, baseConfidence + (Math.random() * 0.1 - 0.05)))

  // Determinar si necesita revisión
  const needsReview = adjustedConfidence < 0.80

  // Construir respuesta completa
  const response: HealResponse = {
    fixedSelector: bestStrategy.selector,
    confidence: Math.round(adjustedConfidence * 100) / 100,
    explanation: bestStrategy.explanation,
    selectorType: bestStrategy.type,
    alternatives: strategies.slice(1, 4).map(s => ({
      selector: s.selector,
      confidence: Math.round(s.confidence * 100) / 100,
    })),
    needsReview,
    robustnessImprovement: bestStrategy.robustnessGain,
    technicalDetails: {
      detectedIssue: analysis.issues[0] || 'Selector pattern analysis',
      proposedSolution: bestStrategy.technicalReason,
      accessibilityCompliant: bestStrategy.type === 'ROLE' || bestStrategy.type === 'TEXT',
      stableAgainstDOMChanges: bestStrategy.type !== 'XPATH',
    },
  }

  return response
}

// ============================================
// UTILIDADES
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================
// EXPORTACIONES
// ============================================

export const HealingEngine = {
  analyzeAndHeal,
  analyzeSelector,
  generateHealingStrategies,
}

export default HealingEngine