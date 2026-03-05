import { HEALING_SYSTEM_PROMPT } from './prompts'
import Anthropic from '@anthropic-ai/sdk'

export interface HealingSuggestion {
    newSelector: string
    selectorType: string
    confidence: number
    reasoning: string
}

// Singleton — created lazily, reused across requests
let _client: Anthropic | null = null

function getClient(): Anthropic {
    if (!_client) {
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
        _client = new Anthropic({ apiKey })
    }
    return _client
}

/**
 * Model used for healing analysis.
 * Claude 3.5 Haiku — fast, cheap, great at structured JSON output.
 */
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

export async function analyzeBrokenSelector(
    failedSelector: string,
    errorMessage: string,
    domSnapshot: string
): Promise<HealingSuggestion | null> {

    // ── Intentar IA real con Claude ─────────────────────────────────
    try {
        const client = getClient()

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

        const message = await client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 512,
            temperature: 0.2,
            system: HEALING_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const content = message.content[0]
        if (content.type !== 'text') throw new Error('Non-text response')

        const text = content.text
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON in response')

        const parsed = JSON.parse(jsonMatch[0])

        if (parsed.newSelector && typeof parsed.confidence === 'number') {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[HealingService] Claude → ${parsed.newSelector} (${Math.round(parsed.confidence * 100)}% conf)`)
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
        console.warn(`[HealingService] Claude failed, using deterministic fallback: ${msg}`)
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
