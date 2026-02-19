import { SelectorType } from '@prisma/client'

export interface AnalyzedSelector {
    selector: string
    type: SelectorType
    score: number // 0.0 - 1.0
    recommendation?: string
}

export class SelectorAnalyzer {
    calculateScore(selector: string, type: SelectorType): number {
        // Advanced Scoring logic
        let score = 0.50

        switch (type) {
            case SelectorType.TESTID:
                score = 0.98
                break
            case SelectorType.ROLE:
                score = 0.92
                break
            case SelectorType.TEXT:
                score = 0.75
                break
            case SelectorType.CSS:
                score = 0.65
                if (selector.includes('[data-') || selector.includes('[aria-')) score += 0.20
                if (selector.startsWith('#')) score -= 0.15 // IDs can be fragile if dynamic
                if (selector.includes(':nth-')) score -= 0.40 // EXTREMELY FRAGILE
                if (selector.split(' ').length > 2) score -= 0.10 * (selector.split(' ').length - 2) // Penalty for depth
                if (selector.match(/\.[a-z0-9]{5,}/i)) score -= 0.20 // Penalty for obfuscated/hashed classes
                break
            case SelectorType.XPATH:
                score = 0.30
                if (selector.includes('html/body')) score -= 0.20 // Absolute XPath
                if (selector.includes('div[') || selector.includes('span[')) score -= 0.10 // Tag + Index
                break
        }

        return Math.max(0.05, Math.min(1.0, score))
    }

    getRecommendation(score: number, type: SelectorType): string | undefined {
        if (score >= 0.85) return undefined // Excellent
        if (score >= 0.65) return 'Consider using a data-testid for better stability.'
        if (score >= 0.40) return 'Medium risk. This selector might break if the UI layout changes slightly.'
        return 'Critical risk. High probability of test failure on minor UI updates. Use data-testid or Role-based selectors.'
    }

    async analyzeProject(projectId: string): Promise<AnalyzedSelector[]> {
        // Mocking a set of selectors from the project
        const rawSelectors = [
            { selector: '[data-testid="submit-btn"]', type: SelectorType.TESTID },
            { selector: 'button:has-text("Login")', type: SelectorType.ROLE },
            { selector: '.login-form .submit-btn', type: SelectorType.CSS },
            { selector: '#btn-12345', type: SelectorType.CSS },
            { selector: '/html/body/div[3]/div[1]/input', type: SelectorType.XPATH },
            { selector: '.aBcDe123', type: SelectorType.CSS }, // Hashed class
            { selector: 'div:nth-child(2) > span', type: SelectorType.CSS }, // nth-child
        ]

        return rawSelectors.map(s => {
            const score = this.calculateScore(s.selector, s.type)
            return {
                selector: s.selector,
                type: s.type,
                score,
                recommendation: this.getRecommendation(score, s.type)
            }
        })
    }
}

export const selectorAnalyzer = new SelectorAnalyzer()
