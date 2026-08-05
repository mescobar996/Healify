[← Documentation](README.md) · [Healify](../README.md) · [Español](jira.es.md)

---

# Defect reporting: Jira, GitHub Issues, webhook

> Opt-in and off by default. Your credentials against your instance — Healify has no server of its own.

Closes the "broken selector → ticket" loop. Three rules that aren't up for negotiation:

1. **Opt-in, off by default.** Without `agile.enabled: true` Healify never touches the network.
2. **Your credentials against YOUR instance.** You provide the token; it's read from the environment so you don't commit it, and it only ever authenticates against **your** Jira or **your** repo. It's never logged.
3. **Zero data off your machine.** The only thing leaving is the POST to your tracker. No Healify cloud, no API key of ours, no tracking.

## Pick a destination

| Provider | Who it's for | What it needs |
|---|---|---|
| `jira` | Teams on Jira Cloud | `baseUrl`, `email`, `apiToken`, `project` |
| `github` | Anyone whose code is on GitHub | `repository`, `apiToken` |
| `webhook` | Zapier, n8n, or a tracker that isn't listed | `webhookUrl` |

### GitHub Issues

The fastest to set up: if your code is on GitHub, you already have everything.

```js
module.exports = {
  agile: {
    enabled: true,
    provider: 'github',
    repository: 'your-user/your-repo',
    apiToken: process.env.HEALIFY_GITHUB_TOKEN,
    labels: ['healify', 'broken-selector'],
  },
}
```

In a workflow the token GitHub already gives you is enough:

```yaml
permissions:
  issues: write        # ← without this the token can't create issues

steps:
  - run: npx playwright test
    continue-on-error: true
  - run: npx healify report
    env:
      HEALIFY_AGILE_ENABLED: 'true'
      HEALIFY_AGILE_PROVIDER: github
      HEALIFY_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> The token is read from `HEALIFY_GITHUB_TOKEN` and **not** from plain `GITHUB_TOKEN`, even though the runner exports that variable in every workflow. Picking it up on its own would turn a misconfigured `healify report` into a silent attempt to write to your repo: enabling this has to be a written decision.

### Jira Cloud

```js
module.exports = {
  agile: {
    enabled: true,
    provider: 'jira',
    baseUrl: 'https://your-team.atlassian.net',
    email: 'qa@your-team.com',
    apiToken: process.env.JIRA_API_TOKEN,
    project: 'QA',
    issueType: 'Bug',
    priorityBySeverity: { blocker: 'Highest', major: 'High', minor: 'Medium' },
    labels: ['healify'],

    attachEvidence: true,          // uploads the failure screenshot to the ticket
    transitionOnHealed: 'Done',    // closes it once Healify resolves the selector
  },
}
```

## Every option

| Option | Default | What it does |
|---|---|---|
| `agile.enabled` | `false` | Turns reporting on. Without it, no-op. |
| `agile.provider` | `jira` | `jira`, `github` or `webhook`. |
| `agile.baseUrl` | — | Jira: your instance. GitHub: only for GitHub Enterprise. |
| `agile.email` | — | Jira only. |
| `agile.apiToken` | — | Jira: API token. GitHub: token with `repo` scope. |
| `agile.repository` | `GITHUB_REPOSITORY` | GitHub only, `owner/repo`. |
| `agile.project` | — | Jira only. Project key, e.g. `QA`. |
| `agile.issueType` | `Bug` | Jira only. |
| `agile.priorityBySeverity` | `blocker→Highest, major→High, minor→Medium` | Severity→priority mapping. |
| `agile.labels` | `[]` | Ticket labels. |
| `agile.attachEvidence` | `false` | Uploads screenshots and traces to the ticket. Jira only. |
| `agile.transitionOnHealed` | — | Status to move the ticket to once Healify resolves and **verifies** the selector. Jira only. |
| `agile.webhookUrl` | — | Webhook only. |

CI environment variables: `HEALIFY_AGILE_ENABLED`, `HEALIFY_AGILE_PROVIDER`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT`, `JIRA_ISSUE_TYPE`, `HEALIFY_GITHUB_TOKEN`, `HEALIFY_GITHUB_REPOSITORY`, `HEALIFY_WEBHOOK_URL`.

## Run it

```bash
healify report                 # reports healify-report.json
healify report --dry-run       # what it would report, without touching the network
```

## Why it won't flood your backlog

Every defect carries a stable `defectId` (`HLF-XXXXXXXX`, sha1 of file + selector): the same broken selector produces the same ID on every run.

Before creating anything, Healify asks whether that defect already exists. If it does, it **comments on the existing ticket** instead of opening another. Without this, a broken selector nobody fixes would file one ticket per CI run, and the backlog would be useless within a week.

A 503 from your tracker doesn't lose the local report: that one defect fails, not the run.

With `provider: 'webhook'` the dedupe is on your side — Healify POSTs the payload with the `defectId` inside, and your automation decides whether to create or update.

## Two details you only hit in practice

**Evidence.** Without `attachEvidence`, the ticket lists the screenshot as a link to `test-results/checkout/failure.png` — a path on the disk of whoever ran the tests, which doesn't exist for whoever opens the ticket. With the option on, the file is actually uploaded. It's opt-in separately from `enabled` because a screenshot of a staging environment can contain real data, and that call isn't Healify's to make.

**Transitions.** `transitionOnHealed` only fires when the case comes back `healed` **and** `verified` — that is, when Healify found the element on the page, not when it inferred a plausible name. If your project's workflow doesn't offer that transition, the ticket is still created and nothing breaks.
