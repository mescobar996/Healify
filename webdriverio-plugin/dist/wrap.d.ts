import { type HealifyWebdriverIOOptions, type HealingEvent } from './types';
interface WdioBrowser {
    $(selector: string): unknown;
    [key: string]: unknown;
}
/**
 * Envuelve un browser de WebdriverIO en un proxy que intercepta las llamadas a $()
 * y cura selectores rotos usando analyzeAndHeal() de @healify/reporter-core.
 *
 * WebdriverIO es lazy: $() no tira error hasta que se interactúa con el elemento.
 * El proxy intercepta el retorno de $() y wrappea sus métodos de interacción
 * (click, setValue, getText, etc.) para capturar el error en el momento correcto.
 */
export declare function wrapBrowser(browser: WdioBrowser, options?: HealifyWebdriverIOOptions): WdioBrowser;
/** Devuelve los eventos acumulados — para testing o para flush manual. */
export declare function getEvents(_browser: WdioBrowser): HealingEvent[];
export {};
