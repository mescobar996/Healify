import { wrapBrowser } from './wrap';
import type { HealifyWebdriverIOOptions } from './types';
export declare class HealifyWebdriverIOPlugin {
    private readonly options;
    private readonly events;
    constructor(options?: HealifyWebdriverIOOptions);
    /** Devuelve un proxy sobre el browser — el original nunca se muta. */
    wrap(browser: ReturnType<typeof wrapBrowser> extends infer T ? Record<string, unknown> : never): Record<string, unknown>;
    /**
     * Escribe healify-report.json con todos los eventos acumulados desde la última llamada.
     * Mismo formato que Playwright/Cypress/Selenium.
     * Devuelve la cantidad de casos escritos.
     */
    flush(cwd?: string): number;
}
