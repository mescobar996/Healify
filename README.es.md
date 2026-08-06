<div align="center">
  <img src="logo-healify.png" alt="Healify" width="110" />

  <h3>Tus tests se rompieron. No cambió nada del producto.</h3>
  <p><strong>Healify encuentra el selector nuevo y te lo arregla.<br/>Sin mandar una sola línea de tu código a ningún lado.</strong></p>

  <a href="https://www.npmjs.com/package/@healify/cli"><img src="https://img.shields.io/npm/v/@healify/cli" alt="npm" /></a>
  <a href="https://github.com/mescobar996/Healify/actions/workflows/ci.yml"><img src="https://github.com/mescobar996/Healify/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" />
  <img src="https://img.shields.io/badge/100%25%20local-true-blue" />

  <p>
    <a href="docs/"><strong>Documentación</strong></a> ·
    <a href="examples/"><strong>Ejemplos</strong></a> ·
    <a href="https://healify-sigma.vercel.app"><strong>Demo</strong></a> ·
    <a href="README.md">English</a>
  </p>
</div>

---

Un botón cambió de `id` en el último deploy. No cambió el producto, cambió un atributo que nunca
debió importar. Y aun así tu suite se pinta de rojo, alguien frena lo que estaba haciendo, abre
el DOM a mano y busca la única línea que hay que tocar.

Eso no es un bug. Es un selector frágil. Y pasa todos los días.

```bash
npx @healify/cli@latest fix
```

```diff
- await page.click('#add-to-cart-btn')
+ await page.getByRole('button', { name: 'Agregar al carrito' }).click()
```

Listo. Volvé a lo tuyo.

---

## No adivina

Cuando tu test falla, tu framework ya guardó cómo estaba la página en ese momento exacto.
Healify lee **esa** evidencia: ahí había un botón cuyo nombre accesible era *"Agregar al
carrito"*. La sugerencia sale verificada contra lo que había de verdad en pantalla, no contra
lo que un modelo de lenguaje cree que probablemente estaba.

Por eso propone roles y nombres accesibles en vez de otro `id`: el `id` nuevo también va a
cambiar en el próximo deploy. El botón que dice "Agregar al carrito", no.

## Nada sale de tu máquina

Sin nube. Sin cuenta. Sin API key. Sin telemetría. Sin IA generativa.

El análisis corre entero donde vos estás, con heurística determinista: mismo input, mismo
resultado, siempre. Si trabajás con datos sensibles (banca, salud, gobierno) eso no es una
comodidad, es el único requisito que importa.

## Contra lo que hay hoy

Antes de escribir una línea se investigaron 15 herramientas del rubro
([el análisis completo](docs/research/competitive-gaps.md)):

| | Healify | El resto |
|---|---|---|
| **Para empezar** | Un `npx` | Docker + Postgres, o una cuenta en la nube |
| **Cómo decide** | Heurística determinista, auditable | Un LLM que contesta distinto cada vez, o un backend cerrado |
| **Qué sale de tu máquina** | Nada | El DOM de tu aplicación |
| **Costo** | Cero, para siempre | Infraestructura, o suscripción |

Healenium, el referente del rubro, está muy bien hecho. Resuelve otro problema: el tuyo no
necesita una base de datos, necesita que alguien te diga "usá esto" antes de que se te enfríe
el café.

## Funciona donde ya estás

**Playwright · Cypress · Selenium · WebdriverIO**

Incluso donde cuesta: dentro de web components con shadow DOM, en iframes, y cuando el selector
vive en un page object y no en el test.

## Te abre el ticket

Un build en rojo que nadie triangula es un build en rojo que nadie arregla. Healify convierte
cada selector roto en un **ticket de Jira o un issue de GitHub**, con la evidencia, los pasos,
el entorno, y el selector que propone en su lugar.

```bash
npx healify report --dry-run   # qué se reportaría exactamente, sin tocar la red
```

El mismo selector roto nunca abre dos tickets: cada defecto lleva un id estable, y Healify
comenta en el que ya existe en vez de crear otro. Opt-in y apagado por default: tus
credenciales, tu instancia, sin ninguna nube nuestra en el medio.

**[→ Jira, GitHub Issues y webhooks](docs/jira.es.md)**

## Y funciona en tu editor

Hay una [extensión de VS Code](vscode-extension/). Los selectores frágiles quedan subrayados
mientras escribís. Los que se rompieron de verdad traen un fix verificado con `Ctrl+.`

Los dos niveles son distintos a propósito. Antes de correr nada, Healify puede decirte que un
selector es frágil, pero no te propone reemplazo: sin ver la página, cualquier nombre concreto
sería inventado. Después de una corrida sabe que el elemento existe y cómo se llama, así que el
fix es real y aplicarlo es una tecla.

---

<div align="center">

### Empezá acá

**[Documentación](docs/)** · instalación, comandos, configuración

**[Ejemplos que se corren](examples/)** · proyectos completos, verificados en CI contra un browser real

**[Demo](https://healify-sigma.vercel.app)**

</div>

---

<sub>
MIT · Cada release firmado y trazable a un commit público
(<a href="https://search.sigstore.dev/?packageName=%40healify">verificalo acá</a>) ·
© 2026 Matías Escobar, Rosario, Argentina
</sub>
