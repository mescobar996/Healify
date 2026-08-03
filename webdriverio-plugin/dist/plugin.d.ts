import type { HealifyWebdriverIOOptions } from './types';
export declare class HealifyWebdriverIOPlugin {
    private readonly options;
    private readonly events;
    private readonly auditEntries;
    private readonly repertoire;
    constructor(options?: HealifyWebdriverIOOptions);
    /**
     * Devuelve un proxy sobre el browser — el original nunca se muta.
     *
     * Genérico a propósito: `WebdriverIO.Browser` es una interfaz sin index signature, así que
     * no es asignable a `Record<string, unknown>` y tiparlo así rompía el uso real (ver
     * healify.wdio.example.ts). Con `<T extends object>` el usuario además conserva el tipado
     * y el autocompletado de su propio browser, que es lo que el proxy devuelve en runtime.
     */
    wrap<T extends object>(browser: T): T;
    /**
     * Escribe healify-report.json con todos los eventos acumulados desde la última llamada
     * (o desde el inicio si nunca se llamó). Mismo formato que Playwright/Cypress/Selenium.
     * También escribe healify-audit.json si hay entradas de auditoría.
     * Devuelve la cantidad de casos escritos.
     */
    flush(cwd?: string): number;
}
