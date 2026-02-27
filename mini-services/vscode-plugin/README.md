# Healify VS Code Plugin (MVP)

MVP extension to quickly open Healify dashboard and test runs from VS Code.

## Commands

- `Healify: Open Latest Test Run`
  - Opens `/dashboard/tests` in your Healify app.
  - Optional: paste a run ID to open `/dashboard/tests/{id}` and worker status endpoint.

- `Healify: Open Dashboard Panel`
  - Opens a simple webview panel with links to dashboard and test runs.

## Settings

- `healify.appUrl`
  - Base URL of your Healify app.
  - Default: `https://healify-sigma.vercel.app`

## Local Run

```bash
cd mini-services/vscode-plugin
npm install
npm run compile
```

Then press `F5` in VS Code from the plugin folder to launch an Extension Development Host.
