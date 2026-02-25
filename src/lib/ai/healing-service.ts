import { HEALING_SYSTEM_PROMPT } from './prompts'
import ZAI from 'z-ai-web-dev-sdk'

export interface HealingSuggestion {
    newSelector: string
    selectorType: string
    confidence: number
    reasoning: string
}

export async function analyzeBrokenSelector(
    failedSelector: string,
    errorMessage: string,
    domSnapshot: string
): Promise<HealingSuggestion | null> {

    // ── Intentar IA real con ZAI ────────────────────────────────────
    try {
        const zai = await ZAI.create()

        const prompt = `Selector que falló: ${failedSelector}
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

        const completion = await zai.chat.completions.create({
            messages: [
                { role: 'system', content: HEALING_SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            temperature: 0.2,
        })

        const content = completion.choices[0]?.message?.content
        if (!content) throw new Error('Empty response')

        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON in response')

        const parsed = JSON.parse(jsonMatch[0])

        if (parsed.newSelector && typeof parsed.confidence === 'number') {
            console.log(`[HealingService] AI -> ${parsed.newSelector} (${Math.round(parsed.confidence * 100)}% conf)`)
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
        console.warn(`[HealingService] ZAI failed, using deterministic fallback: ${msg}`)
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
