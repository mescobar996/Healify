[← Documentation](README.md) · [Healify](../README.md) · [Español](reports.es.md)

---

# Reports & dashboard

> What Healify leaves on disk after each run: the deliverable you hand to your team.

This is what a QA engineer takes away from here: not a console log, a deliverable.

`healify-report.html` is an interactive visual report (dark/light, 100% offline) with:

- Before/after for each healed selector, with a confidence level
- **Verified vs heuristic**: whether the suggestion was checked against that run's real DOM (`verified: true`) or is an inference from the selector's text (`verified: false`) — a guess is never presented as a fact
- Context from the DOM and from the original error message
- A stable `defectId` (same broken selector, same file → same ID on every run) and severity, so you can cross-reference against your bug tracker without reinventing anything

It also generates `healify-report.json` (structured data to plug into your own dashboard),
`healify-report.md` (paste it straight into a PR or a ticket) and `healify-audit.json` (the full
trail for every selector, for when someone asks "where did this come from?").
