/**
 * Convierte un selector string de WebdriverIO a un selector que analyzeAndHeal() puede interpretar.
 * WebdriverIO usa strings directos (CSS, XPath, etc.) — no tiene la clase By de Selenium.
 */
export declare function wdioSelectorToSelector(selector: string): string | null;
/**
 * analyzeAndHeal() devuelve algunas sugerencias en sintaxis de Playwright
 * (role('button', {...}), button:has-text('X'), visible=..., getByRole(...)).
 * WebdriverIO no tiene motor de Playwright para interpretarlas — rechazar las que no son CSS válido.
 */
export declare function isWdioCssCompatible(selector: string): boolean;
