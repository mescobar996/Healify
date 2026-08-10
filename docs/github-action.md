[← Documentation](README.md) · [Healify](../README.md) · [Español](github-action.es.md)

---

# GitHub Action

> Comments broken selectors on the PR. Never modifies files.

Runs `doctor` + `fix --dry-run` and posts the result as a PR comment: **it never modifies files**.

```yaml
# .github/workflows/healify.yml
name: Healify
on: pull_request

permissions:
  contents: read
  pull-requests: write   # without this the API returns 403 when commenting

jobs:
  healify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright test
        continue-on-error: true   # we want the report even if the suite fails
      - uses: mescobar996/Healify@v2
```

`@v2` is a moving alias for the latest `2.x`, published on every release. Pin an exact tag
(`@v2.5.0`) if you want a frozen version.

## Inputs

| Input | Default | What it does |
|---|---|---|
| `github-token` | `${{ github.token }}` | Token used to comment. Needs `pull-requests: write`. |
| `project-path` | `.` | Directory to run Healify in (monorepos). |
| `history-cache` | `true` | Keep `.healify/history.jsonl` across runs (via `actions/cache`) so Healify can tell which selectors keep breaking. Set to `false` to disable. |
| `test-log-path` | `test-output.log` | Path (relative to `project-path`) to the failed test log, read in `workflow_dispatch`/`schedule` runs. |
| `auto-pr` | `true` | In `workflow_dispatch`/`schedule` runs, open a PR with the applied fixes. Set to `false` to apply fixes without opening a PR. |
| `fail-on-unsupported` | `false` | Fail the job when Healify cannot analyze the log (missing file, no selectors found, or CLI error). |
| `labels` | `''` | Comma-separated labels to apply to the auto-generated PR. |

## Auto-PR mode (workflow_dispatch / schedule)

In `pull_request` the action only comments (the inputs above have no effect). In manual or
scheduled runs you can have it **open a PR with the fixes applied**: the workflow runs your tests
redirecting the output to a log file, and the action parses that log, extracts the broken
selectors, applies the fixes on a branch and opens a PR. A copyable workflow template lives at
`examples/github-action-auto-pr/healify.yml` (in `examples/`, not `.github/workflows/`, so it
does not run inside the Healify repo itself).

The comment is **updated** on every push instead of piling up a new one. Zero runtime
dependencies: the action talks to the GitHub API over `fetch`, nothing else.
