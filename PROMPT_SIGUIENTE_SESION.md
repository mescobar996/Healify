Leé primero `C:\Proyectos\QA\Healify\HANDOFF.md` completo — tiene todo el contexto de la
sesión anterior (qué es Healify, qué se hizo, qué está publicado, y una sección específica
"7. IMPORTANTE — qué es demo y qué es real" que tenés que entender antes de tocar nada.

## Objetivo de esta sesión

No quiero más demos. Quiero que analices TODO lo que se armó hasta ahora (Healify y su
integración en `C:\Proyectos\sgo-pzbp`) y soluciones todos los problemas reales que
encuentres — no solo los que ya están documentados en el HANDOFF, cualquiera que aparezca
al auditar de verdad.

## Tareas concretas

1. **Auditá `C:\Proyectos\QA\Healify` de punta a punta**: leé el código de los 5
   workspaces (no solo lo que tocó la sesión anterior — el motor completo,
   `healing-engine.ts`, los 3 plugins, el cli entero). Buscá bugs reales, no cosméticos:
   casos donde el motor propone algo que no tiene sentido, edge cases sin cubrir,
   inconsistencias entre lo que dice la doc y lo que hace el código. Si encontrás algo,
   arreglalo y probalo con el binario real, no solo con el test unitario.

2. **Sacá los archivos demo/scaffold de `sgo-pzbp`** (`e2e/healify.demo.spec.ts`,
   `healify.selenium.demo.ts`, `healify.selenium.example.ts`, `healify-report.html`,
   `healify-report.json`, `test-results/`) — ya cumplieron su función de probar que
   Healify funciona. Confirmá con `git status` en `sgo-pzbp` antes de borrar nada, para no
   tocar los cambios ajenos que ya estaban ahí (`package-lock.json`, `package.json`,
   `migrations/015_notifications_update_policy.sql` — esos NO son míos, no los toques).

3. **Escribí tests e2e REALES para `sgo-pzbp`** — de la app de verdad (login, alguna
   pantalla real de gestión de tareas/visitas técnicas, lo que tenga sentido según el
   código de `sgo-pzbp`). Necesito ver Healify actuando sobre un selector que se rompe de
   verdad, no un selector inventado. Si no sabés qué flujo probar, leé el código de
   `sgo-pzbp/src` primero y elegí uno real y simple (ej. un botón con `data-testid` que
   exista de verdad, y probar que si le cambio el testid, Healify lo detecta y propone la
   cura correcta).

4. **`playwright.config.ts` en `sgo-pzbp` se queda** (es config real, no demo) — verificá
   que sigue bien wireado con el reporter de Healify después de que agregues tests reales.

5. **Verificación real, no solo `npm run verify`**: corré los tests e2e reales contra
   `sgo-pzbp` con el dev server levantado, confirmá que el reporte que genera Healify
   tiene sentido para un caso real (no solo el "healed" garantizado del demo viejo).

6. **Actualizá `HANDOFF.md`** al final con qué cambió, para que la próxima sesión (sea
   otra IA o yo) tenga contexto fresco sin repetir el trabajo.

## Reglas (no negociables, ya establecidas en el HANDOFF)

- Nunca corras `npm publish` ni toques 2FA — yo publico desde mi terminal. Dame los
  comandos exactos si hace falta republicar algo.
- Nunca hagas `git push` sin que yo lo pida explícitamente en esta sesión.
- No me des vueltas ni me muestres algo "para probar el mecanismo" sin decírmelo clarísimo
  de entrada. Si algo es un demo/simulación, decilo ANTES de que yo lo corra, no después
  de que pregunte 3 veces.
- Estilo caveman: cambios mínimos, sin sobre-ingeniería, siempre verificado con el
  binario/reporte real antes de decir que algo "funciona".
