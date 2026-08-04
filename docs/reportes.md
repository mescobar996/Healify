[← Documentación](README.md) · [Healify](../README.md)

---

# Reportes y dashboard

> Lo que Healify deja en disco después de cada corrida: el entregable que le pasás al equipo.

Esto es lo que un QA se lleva de acá: no un log de consola, un entregable.

`healify-report.html` es un reporte visual interactivo (dark/light, 100% offline) con:

- Antes/después de cada selector curado, con nivel de confianza
- **Verificado vs heurístico**: si la sugerencia se confrontó contra el DOM real de esa corrida (`verified: true`) o es una deducción sobre el texto del selector (`verified: false`) — nunca se presenta una adivinanza como un hecho
- Contexto del DOM y del mensaje de error original
- `defectId` estable (mismo selector roto, mismo archivo → mismo ID en cada corrida) y severidad, para cruzar contra tu tracker de bugs sin reinventar la rueda

También genera `healify-report.json` (datos estructurados para integrarlo a tu propio dashboard), `healify-report.md` (pegalo tal cual en una PR o un ticket) y `healify-audit.json` (el trail completo de cada selector, por si alguien pregunta "¿y esto de dónde salió?").
