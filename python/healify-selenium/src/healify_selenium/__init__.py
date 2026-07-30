"""
Healify + Selenium (Python).

Llama al motor real de Healify (`reporter-core`, el mismo que usan los cuatro adapters de
JS) vía `npx @healify/cli heal`, así que necesitás Node instalado y `@healify/cli`
accesible por `npx` en el proyecto — no hay heurística reimplementada acá, es un cliente
delgado.

Requiere: pip install selenium (4.6+, trae Selenium Manager — resuelve el driver solo).

Uso mínimo:

    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from healify_selenium import HealifySeleniumWrapper

    driver = webdriver.Chrome()
    healify = HealifySeleniumWrapper(driver, project_root=".")
    el = healify.find_element(By.CSS_SELECTOR, "#comprar-ahora-a1b2c3")
    el.click()

Qué SÍ hace: envuelve find_element (no cada método de interacción — mismo alcance acotado
que selenium-plugin en JS). Qué NO hace: generar healify-report.html/json/md (eso queda para
una integración más completa, más adelante).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By

__version__ = "0.1.0"
__all__ = ["HealifySeleniumWrapper", "HealEvent", "DEFAULT_CONFIDENCE_THRESHOLD"]

# Mismo umbral que HEALED_THRESHOLD en reporter-core/src/local-mode.ts — acá no hay paso de
# revisión humana, así que el piso para actuar solo tiene que ser el más alto que el motor
# ya define.
DEFAULT_CONFIDENCE_THRESHOLD = 0.9

# Convierte By.X a un selector CSS/XPath que analyzeAndHeal() sabe interpretar. Mismo
# criterio que locator.ts en selenium-plugin (JS): By.ID/CLASS_NAME/NAME no necesitan
# tratamiento especial porque Selenium ya los resuelve a CSS antes de que lleguen acá. Los
# que no tienen equivalente limpio (LINK_TEXT, TAG_NAME) devuelven None — no convertible.
_CONVERTIBLE_STRATEGIES = {By.CSS_SELECTOR, By.ID, By.CLASS_NAME, By.NAME, By.XPATH}


def _locator_to_selector(by: str, value: str) -> str | None:
    if by not in _CONVERTIBLE_STRATEGIES:
        return None
    if by == By.ID:
        return f"#{value}"
    if by == By.CLASS_NAME:
        return f".{value}"
    if by == By.NAME:
        return f"[name='{value}']"
    return value


@dataclass
class HealEvent:
    type: str
    original_selector: str
    fixed_selector: str | None = None
    confidence: float | None = None
    explanation: str | None = None
    verified: bool = False
    from_repertoire: bool = False


class HealifySeleniumWrapper:
    """Envuelve un WebDriver de Selenium: si find_element falla, prueba curarlo vía
    `npx @healify/cli heal`, reintenta con el locator que devuelve, y (opcionalmente) graba
    el resultado en .healify/history.jsonl para alimentar el repertorio compartido."""

    def __init__(
        self,
        driver: Any,
        project_root: str | Path = ".",
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
        dry_run: bool = False,
        record_history: bool = True,
        healify_cmd: list[str] | None = None,
    ) -> None:
        self.driver = driver
        self.project_root = Path(project_root)
        self.confidence_threshold = confidence_threshold
        self.dry_run = dry_run
        self.record_history = record_history
        self._healify_cmd = healify_cmd or self._default_healify_cmd()
        self._probe_script: str | None = None
        self.events: list[HealEvent] = []
        # Opcional: seteá esto antes de cada test (ej. en un fixture de pytest, con
        # request.node.name o la ruta del archivo) para que el repertorio pueda scopear por
        # archivo, igual que hacen Playwright/Cypress. Sin esto, el match es por selector solo.
        self.current_test_file: str | None = None

    @staticmethod
    def _default_healify_cmd() -> list[str]:
        # subprocess.run sin shell=True no resuelve extensiones en Windows: "npx" ahí es en
        # realidad "npx.cmd", y CreateProcess no lo encuentra sin el .cmd explícito (a
        # diferencia de cmd.exe, que sí lo resuelve solo). shutil.which() sí sabe resolverlo
        # en cualquier plataforma — bug real encontrado corriendo esto contra Windows, no en
        # teoría (fallaba con "[WinError 2] El sistema no puede encontrar el archivo...").
        npx = shutil.which("npx")
        return [npx or "npx", "@healify/cli"]

    def _emit(self, event: HealEvent) -> None:
        self.events.append(event)

    def _probe(self) -> list[dict] | None:
        """Sondea el DOM real en el momento del fallo — mismo BROWSER_PROBE_SCRIPT que usan
        los plugins JS, corrido acá vía execute_script(). Se pide una sola vez y se
        cachea: el script no cambia entre llamadas."""
        if self._probe_script is None:
            try:
                result = subprocess.run(
                    [*self._healify_cmd, "probe-script"],
                    capture_output=True,
                    text=True,
                    cwd=self.project_root,
                    timeout=30,
                )
                self._probe_script = result.stdout if result.returncode == 0 else ""
            except Exception:
                self._probe_script = ""

        if not self._probe_script:
            return None
        try:
            return self.driver.execute_script(self._probe_script)
        except Exception:
            return None

    def _heal(self, selector: str, test_name: str | None = None) -> dict | None:
        page_elements = self._probe()
        payload = {"selector": selector}
        if test_name:
            payload["testFile"] = test_name
        if page_elements:
            payload["pageElements"] = page_elements

        try:
            result = subprocess.run(
                [*self._healify_cmd, "heal"],
                input=json.dumps(payload),
                capture_output=True,
                text=True,
                cwd=self.project_root,
                timeout=30,
            )
            output = json.loads(result.stdout)
        except Exception as exc:
            self._emit(HealEvent(type="error", original_selector=selector, explanation=str(exc)))
            return None

        if "error" in output:
            self._emit(HealEvent(type="error", original_selector=selector, explanation=output["error"]))
            return None

        return output

    def find_element(self, by: str, value: str):
        try:
            return self.driver.find_element(by, value)
        except NoSuchElementException as original_err:
            selector = _locator_to_selector(by, value)
            if selector is None:
                self._emit(HealEvent(type="not-convertible", original_selector=value))
                raise

            test_name = getattr(self, "current_test_file", None)
            healed = self._heal(selector, test_name)
            if healed is None:
                raise

            if healed["confidence"] < self.confidence_threshold:
                self._emit(HealEvent(type="no-suggestion", original_selector=selector, confidence=healed["confidence"]))
                raise

            locator = healed["locator"]
            if locator["strategy"] == "unsupported":
                self._emit(HealEvent(type="no-suggestion", original_selector=selector, fixed_selector=healed["fixedSelector"]))
                raise

            retry_by = By.XPATH if locator["strategy"] == "xpath" else By.CSS_SELECTOR

            if self.dry_run:
                self._emit(HealEvent(
                    type="healed", original_selector=selector, fixed_selector=healed["fixedSelector"],
                    confidence=healed["confidence"], explanation=healed["explanation"],
                    verified=healed["verified"], from_repertoire=healed["fromRepertoire"],
                ))
                if self.record_history:
                    self._append_history(selector, healed, test_name, status="healed")
                raise original_err

            try:
                healed_el = self.driver.find_element(retry_by, locator["value"])
            except NoSuchElementException:
                self._emit(HealEvent(type="failed", original_selector=selector, fixed_selector=healed["fixedSelector"]))
                raise original_err

            self._emit(HealEvent(
                type="healed", original_selector=selector, fixed_selector=healed["fixedSelector"],
                confidence=healed["confidence"], explanation=healed["explanation"],
                verified=healed["verified"], from_repertoire=healed["fromRepertoire"],
            ))
            if self.record_history:
                self._append_history(selector, healed, test_name, status="healed")
            return healed_el

    def _append_history(self, selector: str, healed: dict, test_file: str | None, status: str) -> None:
        """Mismo formato que HistoryEntry (reporter-core/src/repertoire.ts) — así una
        curación confirmada desde Python queda disponible para el repertorio de cualquier
        otro lenguaje que corra contra el mismo repo, JS incluido."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "testFile": test_file,
            "testName": test_file or selector,
            "selector": selector,
            "status": status,
            "fixedSelector": healed["fixedSelector"],
            "selectorType": healed["selectorType"],
            "confidence": healed["confidence"],
            "verified": healed["verified"],
        }
        history_dir = self.project_root / ".healify"
        history_dir.mkdir(exist_ok=True)
        with open(history_dir / "history.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
