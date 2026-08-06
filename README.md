<div align="center">
  <img src="logo-healify.png" alt="Healify" width="110" />

  <h3>Your tests broke. Nothing about the product changed.</h3>
  <p><strong>Healify finds the new selector and fixes it for you.<br/>Without sending a single line of your code anywhere.</strong></p>

  <a href="https://www.npmjs.com/package/@healify/cli"><img src="https://img.shields.io/npm/v/@healify/cli" alt="npm" /></a>
  <a href="https://github.com/mescobar996/Healify/actions/workflows/ci.yml"><img src="https://github.com/mescobar996/Healify/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" />
  <img src="https://img.shields.io/badge/100%25%20local-true-blue" />

  <p>
    <a href="docs/"><strong>Docs</strong></a> ·
    <a href="examples/"><strong>Examples</strong></a> ·
    <a href="https://healify-sigma.vercel.app"><strong>Demo</strong></a> ·
    <a href="README.es.md">Español</a>
  </p>
</div>

---

A button changed its `id` in the last deploy. The product didn't change. An attribute generated
by your bundler did, one that should never have mattered. And yet your suite goes red, someone
drops what they were doing, opens the DOM by hand and hunts for the single line that needs
touching.

That's not a bug. It's a brittle selector. And it happens every day.

```bash
npx @healify/cli@latest fix
```

```diff
- await page.click('#add-to-cart-btn')
+ await page.getByRole('button', { name: 'Add to cart' }).click()
```

Done. Back to what you were doing.

---

## It doesn't guess

When your test fails, your framework has **already captured** what the page looked like at that
exact moment. Healify reads *that* evidence: there was a button whose accessible name was *"Add
to cart"*. The suggestion is verified against what was actually on screen, not against what a
language model thinks was probably there.

That's why it proposes roles and accessible names instead of another `id`: the new `id` will
change in the next deploy too. The button that says "Add to cart" won't.

## Nothing leaves your machine

No cloud. No account. No API key. No telemetry. No generative AI.

The whole analysis runs where you are, on deterministic heuristics: same input, same output,
every time. If you work with sensitive data (banking, healthcare, government) that isn't a
convenience, it's the only requirement that matters.

## How it compares

Playwright now ships its own healer agent, and every testing vendor sells "self-healing." The
label covers wildly different things, so here is where Healify actually sits:

| | Healify | Playwright's healer agent | Healenium |
|---|---|---|---|
| **How it decides** | Deterministic heuristics you can audit | An LLM, different answer each run | Similarity scoring against a database |
| **What leaves your machine** | Nothing | Your DOM goes to a model | Nothing, but needs a server |
| **To get started** | One `npx` | An API key and a budget | Docker + Postgres |
| **When it refuses** | Says so, and why | Rarely - it will propose something | On low similarity score |
| **Cost** | Zero, forever | Per token, forever | Infrastructure to run |

**The honest limit, up front:** broken selectors are roughly a quarter of why e2e tests fail. The
rest is timing, test data, runtime errors and real assertion failures. Healify names that quarter
and refuses the rest instead of guessing — a tool that "fixes" a failing assertion by swapping the
selector makes the test pass while hiding the bug it just caught. That is worse than a red build.

Healenium is genuinely well built and solves a different problem: yours doesn't need a database,
it needs someone to tell you "use this instead" before your coffee gets cold.

<sub>Fifteen tools in this space were researched before a single line was written
([full analysis](docs/research/competitive-gaps.md)).</sub>

## Works where you already are

**Playwright · Cypress · Selenium · WebdriverIO**

Including the hard places: inside web components with shadow DOM, across iframes, and when the
selector lives in a page object rather than in the test itself.

## It files the ticket for you

A red build nobody triages is a red build nobody fixes. Healify turns each broken selector into
a **Jira ticket or a GitHub issue**, with the evidence, the steps, the environment, and the
selector it suggests instead.

```bash
npx healify report --dry-run   # exactly what it would file, without touching the network
```

The same broken selector never files twice: every defect carries a stable id, and Healify
comments on the existing ticket instead of opening another one. Opt-in and off by default: your
credentials, your instance, no cloud of ours in between.

**[→ Jira, GitHub Issues and webhooks](docs/jira.md)**

## And it works in your editor

There's a [VS Code extension](vscode-extension/). Fragile selectors get underlined as you type.
The ones that actually broke get a verified fix on `Ctrl+.`

The two are deliberately different. Before you run anything, Healify can tell you a selector
looks brittle, but it won't suggest a replacement: without seeing the page, any specific name
would be made up. After a run, it knows the element exists and what it's called, so the fix is
real and applying it is one keystroke.

## And your agent can ask it questions

There's an [MCP server](mcp/). Point Claude, Cursor or any MCP client at your test project and it
can ask whether a selector is brittle, why a test failed, and which selectors keep breaking.

```json
{ "mcpServers": { "healify": { "command": "npx", "args": ["-y", "@healify/mcp"] } } }
```

This is the complement to Playwright's MCP server, not a replacement. That one lets an agent
drive a browser. The documented failure of agents doing that is over-confidence: clicking the
first thing that matches, inventing what they can't see. Healify answers deterministically, from
evidence already on disk, and says plainly when it doesn't know — including refusing to name a
replacement it hasn't verified against a real page.

---

<div align="center">

### Start here

**[Documentation](docs/)** · installation, commands, configuration

**[Examples that actually run](examples/)** · complete projects, verified in CI against a real browser

**[Demo](https://healify-sigma.vercel.app)**

</div>

---

<sub>
MIT · Every release signed and traceable to a public commit
(<a href="https://search.sigstore.dev/?packageName=%40healify">verify it here</a>) ·
© 2026 Matías Escobar, Rosario, Argentina
</sub>
