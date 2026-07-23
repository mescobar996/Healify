# Feature #8 — Historical Report with Trends

## Status: APPROVED — Ready for Implementation Plan

---

## Problem

Today each `healify fix` run is ephemeral. Teams can't answer:
- "Which selectors break repeatedly?"
- "Is our healing rate improving?"
- "Which selector types are most reliable?"

---

## Solution: Local JSONL History + `healify history` Command

### Storage: `.healify/history.jsonl` (per project)

```
project-root/
├── .healify/
│   └── history.jsonl      ← append-only, one line per healed case
├── healify-report.json    ← current run
└── tests/
```

**Schema per line:**
```json
{
  "timestamp": "2026-07-23T14:32:11.000Z",
  "runId": "abc123",
  "framework": "Playwright",
  "project": "my-app",
  "testFile": "tests/checkout.spec.ts",
  "testName": "user can checkout",
  "selector": "#btn-submit",
  "fixedSelector": "role('button', { name: 'Submit' })",
  "selectorType": "ROLE",
  "confidence": 0.92,
  "status": "applied",
  "fixMethod": "ast",
  "outcome": "applied",
  "gitCommit": "a1b2c3d"
}
```

**Size estimate:** ~300 bytes/case → ~50 KB/week for active project.

---

## Trends Computed by `healify history`

| Trend | Query | Use Case |
|-------|-------|----------|
| **Top 10 recurrent broken selectors** | `GROUP BY selector ORDER BY count DESC LIMIT 10` | Prioritize adding testids |
| **Re-broken selectors** | `WHERE selector IN (SELECT selector FROM history WHERE outcome='applied') AND outcome='healed' GROUP BY selector` | Detect flaky fixes |
| **Healing rate by week** | `GROUP BY date_trunc('week', timestamp), framework` | Track team adoption |
| **Confidence by selectorType** | `AVG(confidence) GROUP BY selectorType` | Trust ROLE > CSS > XPATH |
| **Time-to-fix** | `MIN(timestamp) WHERE outcome='applied' GROUP BY selector` | SLA for flaky tests |

---

## CLI Integration

### Auto-append on `fix`
```bash
healify fix report.json           # writes history.jsonl automatically
healify fix --ast report.json     # records fixMethod: "ast"
healify fix --dry-run report.json # records outcome: "dry-run"
```

### New Command: `healify history`
```bash
healify history                           # last 30 days, terminal table
healify history --since 7d                # last 7 days
healify history --format json             # machine-readable
healify history --format html --out report.html  # shareable report
healify history --trend rebroken          # only re-broken selectors
healify history --trend confidence        # confidence by type
healify history --no-auto                 # don't auto-append (CI mode)
```

---

## Retention & Config

| Setting | Default | Config Key |
|---------|---------|------------|
| Enabled | `true` | `history.enabled` |
| Retention | 90 days | `history.retentionDays` |
| Auto-append | `true` | `history.autoAppend` |

```bash
healify config set history.retentionDays 180
healify config set history.enabled false
```

---

## Architecture

### New Files
```
cli/src/history/
├── index.ts           # Storage (append, read, prune)
├── trends.ts          # Aggregation queries
├── render.ts          # Terminal/HTML/JSON output
└── commands/
    └── history.ts     # CLI command
```

### Modified Files
| File | Change |
|------|--------|
| `cli/src/commands/fix.ts` | Import `appendHistory()`, call after `fix()`/`fixAst()` |
| `cli/src/config.ts` | Add history settings |
| `cli/package.json` | No new deps (pure Node fs + date-fns if needed) |

---

## Data Flow

```
test run → healify-report.json
    ↓
healify fix [--ast] report.json
    ↓
FixOutcome[] + run metadata
    ↓
appendHistory(outcomes, run)  ← NEW
    ↓
.healify/history.jsonl (append)
    ↓
healify history [--trend X]   ← reads, aggregates, renders
```

---

## Testing Strategy

| Test | Count |
|------|-------|
| Unit: `history/index.ts` (append, read, prune) | ~8 |
| Unit: `history/trends.ts` (each aggregation) | ~6 |
| Integration: `healify history` CLI | ~5 |
| Integration: `fix` auto-append | ~3 |

---

## Rollout

| Version | Change |
|---------|--------|
| v0.7.0 | History enabled by default, `healify history` command |
| v0.8.0 | HTML report output, config options |
| v1.0.0 | Optional: GitHub Action to publish history as artifact |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| File grows unbounded | Auto-prune on read (configurable retention) |
| Sensitive data in selectors | Only selector strings stored; no DOM, no secrets |
| Concurrent writes corrupt JSONL | Single-process CLI; append is atomic on POSIX/Win |
| Team doesn't want tracking | `healify config set history.enabled false` |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `cli/src/history/index.ts` | **NEW** — JSONL storage |
| `cli/src/history/trends.ts` | **NEW** — Aggregations |
| `cli/src/history/render.ts` | **NEW** — Output formats |
| `cli/src/history/commands/history.ts` | **NEW** — CLI command |
| `cli/src/commands/fix.ts` | **MODIFY** — Auto-append |
| `cli/src/config.ts` | **MODIFY** — History settings |
| `cli/src/__tests__/history/` | **NEW** — Test files |

---

## Acceptance Criteria

- [ ] `healify fix report.json` appends to `.healify/history.jsonl`
- [ ] `healify history` shows terminal table (last 30 days)
- [ ] `healify history --format html --out report.html` generates shareable report
- [ ] Trends work: top recurrent, re-broken, confidence by type, healing rate
- [ ] Retention prunes old entries on read
- [ ] Config disables history completely
- [ ] 0 vulnerabilities, build passes, lint passes

---

*Approved: 2026-07-23*  
*Next: Invoke writing-plans for both features*