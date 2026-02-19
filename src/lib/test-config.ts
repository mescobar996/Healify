export interface TestConfig {
    baseUrl: string
    timeout: number
    browser: 'chromium' | 'firefox' | 'webkit'
    headless: boolean
    viewport: { width: number; height: number }
}

export const defaultConfig: TestConfig = {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    timeout: 30000,
    browser: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
}

export function getProjectConfig(projectId: string): TestConfig {
    // In the future, this can fetch from DB
    return {
        ...defaultConfig,
    }
}
