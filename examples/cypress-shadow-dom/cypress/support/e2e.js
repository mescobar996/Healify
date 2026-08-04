// Registra `cy.healifyGet()`. Un import y listo — no pisa `cy.get()` ni el motor de retry de
// Cypress: es un comando nuevo, opt-in, que usás donde querés cura en vivo.
import '@healify/cypress-plugin/support'
