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
      - uses: mescobar996/Healify@v2.2.0
```

That pins an exact tag. `@v2` works as a moving alias for the latest `2.x`, and it's published.

| Input | Default | What it does |
|---|---|---|
| `github-token` | `${{ github.token }}` | Token used to comment. Needs `pull-requests: write`. |
| `project-path` | `.` | Directory to run Healify in (monorepos). |

The comment is **updated** on every push instead of piling up a new one. Zero runtime
dependencies: the action talks to the GitHub API over `fetch`, nothing else.
