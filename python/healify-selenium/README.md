# healify-selenium

Adapter de Python para [Healify](https://github.com/mescobar996/Healify): cuando
`find_element` falla, sondea el DOM real de la página, pide una curación verificada al
motor de Healify y reintenta antes de fallar el test. Local y sin IA — heurística +
verificación contra la página, nunca inventa un selector.

## Instalación

```bash
pip install healify-selenium
```

También necesitás Node.js instalado y `@healify/cli` accesible por `npx` en tu proyecto:

```bash
npm install --save-dev @healify/cli
```

Este paquete es un cliente delgado: no reimplementa la heurística, llama al motor real de
Healify (`@healify/cli heal`/`probe-script`) vía subproceso.

## Uso

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from healify_selenium import HealifySeleniumWrapper

driver = webdriver.Chrome()
healify = HealifySeleniumWrapper(driver, project_root=".")

el = healify.find_element(By.CSS_SELECTOR, "#comprar-ahora-a1b2c3")
el.click()

for event in healify.events:
    print(event)
```

Si el selector se rompió, `find_element` sondea la página (mismo script que usan los
plugins de Selenium/WebdriverIO en JS), pide una curación y reintenta con lo que devuelva —
por CSS o XPath, según corresponda. Si nada sirve, deja pasar el `NoSuchElementException`
original tal cual, sin inventar nada.

## Opciones

```python
HealifySeleniumWrapper(
    driver,
    project_root=".",              # dónde vive @healify/cli y .healify/history.jsonl
    confidence_threshold=0.9,      # piso de confianza para probar una sugerencia
    dry_run=False,                 # curar pero nunca aplicar (solo registra el evento)
    record_history=True,           # grabar curaciones verificadas en .healify/history.jsonl
)
```

`healify.current_test_file = "tests/test_checkout.py"` (opcional, por ejemplo en un fixture
de pytest) permite que el repertorio compartido scopee por archivo, igual que hacen
Playwright/Cypress en JS.

## El repertorio es compartido entre lenguajes

`.healify/history.jsonl` usa el mismo formato en todos los adapters (JS, Python, Java, C#):
una curación verificada en Playwright puede resolver un selector roto en un test de Python
sin sondear nada, si corren contra el mismo repo.

## Qué NO hace

Envuelve solo `find_element` — no cada método de interacción de Selenium (mismo alcance
acotado que `@healify/selenium-plugin` en JS). No genera `healify-report.html/json/md`; eso
queda para una integración más completa, más adelante.

## Verificado

De punta a punta con Selenium 4.46 + Chrome real (Selenium Manager resuelve el
`chromedriver` solo, sin configuración).

## Licencia

MIT. Ver [LICENSE](LICENSE).
