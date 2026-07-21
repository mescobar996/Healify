import { HEALING_SYSTEM_PROMPT } from './prompts'
import { generateText, extractJson } from './local-llm-client'

export interface HealingSuggestion {
    newSelector: string
    selectorType: string
    confidence: number
    reasoning: string
}

interface RawSuggestion {
    newSelector?: string
    selectorType?: string
    confidence?: number
    reasoning?: string
}

export async function analyzeBrokenSelector(
    failedSelector: string,
    errorMessage: string,
    domSnapshot: string
): Promise<HealingSuggestion | null> {

    // ── Intentar IA real con un modelo open-source local (Ollama) ──────
    try {
        const userPrompt = `Selector que falló: ${failedSelector}
Error: ${errorMessage}
DOM actual:
\`\`\`html
${domSnapshot.substring(0, 8000)}
\`\`\`

Responde SOLO con JSON válido (sin markdown):
{
  "newSelector": "string",
  "selectorType": "CSS|XPATH|TESTID|ROLE|TEXT",
  "confidence": 0.0,
  "reasoning": "string"
}`

        const text = await generateText({
            system: HEALING_SYSTEM_PROMPT,
            prompt: userPrompt,
            temperature: 0.2,
            maxTokens: 512,
        })

        const parsed = extractJson<RawSuggestion>(text)

        if (parsed.newSelector && typeof parsed.confidence === 'number') {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[HealingService] LLM local → ${parsed.newSelector} (${Math.round(parsed.confidence * 100)}% conf)`)
            }
            return {
                newSelector: parsed.newSelector,
                selectorType: parsed.selectorType || 'CSS',
                confidence: parsed.confidence,
                reasoning: parsed.reasoning || '',
            }
        }
        throw new Error('Invalid response structure')

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.warn(`[HealingService] LLM local falló, usando fallback determinístico: ${msg}`)
    }

    // ── Fallback determinístico ─────────────────────────────────────
    const testIdMatch = domSnapshot.match(/data-testid=["']([^"']+)["']/)
    if (testIdMatch) {
        return { newSelector: `[data-testid="${testIdMatch[1]}"]`, selectorType: 'TESTID', confidence: 0.88, reasoning: `Stable data-testid found: "${testIdMatch[1]}"` }
    }

    const ariaMatch = domSnapshot.match(/aria-label=["']([^"']+)["']/)
    if (ariaMatch) {
        return { newSelector: `[aria-label="${ariaMatch[1]}"]`, selectorType: 'ROLE', confidence: 0.82, reasoning: `Accessible aria-label found: "${ariaMatch[1]}"` }
    }

    return {
        newSelector: failedSelector,
        selectorType: 'CSS',
        confidence: 0.5,
        reasoning: 'No stable alternative found. Keeping original for manual review.'
    }
}
