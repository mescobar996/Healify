import fs from 'fs/promises'
import path from 'path'
import { analyzeBrokenSelector } from '../src/lib/ai/healing-service'

async function evaluate() {
    const datasetPath = path.join(process.cwd(), 'tests', 'golden-datasets', 'selectors-v1.json')
    const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'))

    console.log(`--- Starting AI Accuracy Evaluation (${dataset.length} cases) ---`)

    let passed = 0
    let total = dataset.length

    for (const testCase of dataset) {
        console.log(`\nEvaluating [${testCase.id}]: ${testCase.description}`)

        try {
            const suggestion = await analyzeBrokenSelector(
                testCase.failedSelector,
                testCase.errorMessage,
                testCase.newDom
            )

            if (!suggestion) {
                console.log('❌ AI failed to return a suggestion.')
                continue
            }

            // Lógica de validación (simplificada para la demo)
            // En un escenario real, usaríamos algo más robusto que un match de string exacto
            const isCorrect = suggestion.newSelector.includes(testCase.expectedSelector) ||
                suggestion.reasoning.toLowerCase().includes(testCase.expectedSelector.toLowerCase())

            if (isCorrect) {
                console.log(`✅ SUCCESS: Sugirió ${suggestion.newSelector} (Confidence: ${suggestion.confidence})`)
                passed++
            } else {
                console.log(`❌ FAIL: Sugirió ${suggestion.newSelector} pero se esperaba algo parecido a ${testCase.expectedSelector}`)
            }
        } catch (error) {
            console.error(`Error processing case ${testCase.id}:`, error)
        }
    }

    const accuracy = (passed / total) * 100
    console.log(`\n--- Evaluation Completed ---`)
    console.log(`Accuracy: ${accuracy.toFixed(2)}% (${passed}/${total})`)
}

evaluate().catch(console.error)
