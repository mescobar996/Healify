[← Documentation](README.md) · [Healify](../README.md) · [Español](jira.es.md)

---

# Jira / webhook reporting

> Opt-in and off by default. Your credentials against your instance — Healify has no server of its own.

Closes the "broken selector → Jira ticket" loop. Three rules that aren't up for negotiation:

1. **Opt-in, off by default.** Without `agile.enabled: true` Healify never touches the network. Silence reports nothing.
2. **Your credentials against YOUR instance.** You provide the Jira token; it's read from config or from `JIRA_API_TOKEN` (so you don't commit it), and it's only ever used to authenticate against **your** Jira. It's never logged, and never leaves for anywhere that isn't your server.
3. **Zero data off your machine.** The only data leaving when you enable reporting is the POST to **your** Jira (or **your** webhook). There's no Healify cloud, no API key of ours, no tracking.

Config in `healify.config.js`:

```js
module.exports = {
  agile: {
    enabled: true,          // ← without this, nothing is reported
    provider: 'jira',       // 'jira' | 'webhook'
    baseUrl: 'https://your-team.atlassian.net',
    email: 'qa@your-team.com',
    apiToken: process.env.JIRA_API_TOKEN,   // or just JIRA_API_TOKEN in the environment
    project: 'QA',
    issueType: 'Bug',
    priorityBySeverity: { blocker: 'Highest', major: 'High', minor: 'Medium' },
    labels: ['healify'],
  },
}
```

| Option | Default | What it does |
|---|---|---|
| `agile.enabled` | `false` | Enables reporting. Without it, no-op. |
| `agile.provider` | `jira` | `jira` (REST Cloud) or `webhook` (Zapier/n8n/Jira automation). |
| `agile.baseUrl` | — | Your Jira Cloud base, e.g. `https://your-team.atlassian.net`. |
| `agile.email` / `agile.apiToken` | — | The user's credentials against their own instance. |
| `agile.project` | — | Project key, e.g. `QA`. |
| `agile.issueType` | `Bug` | Issue type. |
| `agile.priorityBySeverity` | `blocker→Highest, major→High, minor→Medium` | Severity → priority mapping. |
| `agile.labels` | `[]` | Extra labels for the ticket. |
| `agile.webhookUrl` | — | Webhook URL (provider `webhook` only). |

Env overrides for CI: `HEALIFY_AGILE_ENABLED`, `HEALIFY_AGILE_PROVIDER`, `JIRA_BASE_URL`,
`JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT`, `JIRA_ISSUE_TYPE`, `HEALIFY_WEBHOOK_URL`.

Report the last run:

```bash
healify report                 # reports healify-report.json to your Jira
healify report --dry-run       # what would be reported, without touching the network
```

**How it works, and why it doesn't create noise.** Every defect carries a stable `defectId`
(`HLF-XXXXXXXX`, a sha1 of file + selector): the same broken selector yields the same ID on every
run. Before creating a ticket, Healify asks your Jira (`text ~ "HLF-XXXXXXXX" AND project = QA`)
whether that defect already exists: if it does, **nothing new is created** (outcome: `already
existed`); if it doesn't, it creates the issue **and** adds the selector suggestion as a comment.
The suggestion travels as ticket context — it never replaces the finding. A 503 from your Jira
doesn't lose the local report: that defect fails, not the run.

With `provider: 'webhook'`, Healify POSTs the JSON payload (defect + suggestion + environment) to
your URL and the receiver decides whether to create or update — the pattern the rest of the field
already established ("webhook → JQL lookup by stable key → create if missing / comment if
present").
