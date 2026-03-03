#!/usr/bin/env node
/**
 * healify CLI
 *
 * Commands:
 *   healify trigger   --project <id>  --api-key <key>  [--branch <branch>]  [--url <baseUrl>]
 *   healify status    --run <runId>   --api-key <key>  [--url <baseUrl>]
 *   healify stream    --run <runId>   --api-key <key>  [--url <baseUrl>]
 *   healify help
 */

import * as https from 'node:https'
import * as http from 'node:http'
import * as readline from 'node:readline'

// ── Arg parser ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { command: string; flags: Record<string, string> } {
  const args = argv.slice(2)
  const command = args.find(a => !a.startsWith('-')) ?? 'help'
  const flags: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true'
      flags[key] = value
    }
  }
  return { command, flags }
}

// ── HTTP helper ────────────────────────────────────────────────────────────

function req(
  method: string,
  url: string,
  apiKey: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const mod = parsed.protocol === 'https:' ? https : http
    const bodyStr = body ? JSON.stringify(body) : undefined

    const reqObj = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      },
      res => {
        let raw = ''
        res.on('data', chunk => { raw += chunk })
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) })
          } catch {
            resolve({ status: res.statusCode ?? 0, data: raw })
          }
        })
      }
    )
    reqObj.on('error', reject)
    if (bodyStr) reqObj.write(bodyStr)
    reqObj.end()
  })
}

// ── Colours ────────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
}

function color(str: string, ...codes: string[]) {
  return `${codes.join('')}${str}${c.reset}`
}

// ── Banner ─────────────────────────────────────────────────────────────────

function printBanner() {
  console.log()
  console.log(color('  ██╗  ██╗███████╗ █████╗ ██╗     ██╗███████╗██╗   ██╗', c.cyan, c.bold))
  console.log(color('  ██║  ██║██╔════╝██╔══██╗██║     ██║██╔════╝╚██╗ ██╔╝', c.cyan))
  console.log(color('  ███████║█████╗  ███████║██║     ██║█████╗   ╚████╔╝ ', c.cyan))
  console.log(color('  ██╔══██║██╔══╝  ██╔══██║██║     ██║██╔══╝    ╚██╔╝  ', c.cyan))
  console.log(color('  ██║  ██║███████╗██║  ██║███████╗██║██║        ██║   ', c.cyan))
  console.log(color('  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝╚═╝        ╚═╝   ', c.cyan))
  console.log()
  console.log(color('  Self-healing test automation', c.dim))
  console.log()
}

// ── Commands ───────────────────────────────────────────────────────────────

async function cmdTrigger(flags: Record<string, string>) {
  const project = flags['project']
  const apiKey = flags['api-key'] ?? flags['apikey'] ?? process.env.HEALIFY_API_KEY
  const branch = flags['branch']
  const baseUrl = flags['url'] ?? 'https://healify-sigma.vercel.app'

  if (!project) { console.error(color('  ✗ --project is required', c.red)); process.exit(1) }
  if (!apiKey) { console.error(color('  ✗ --api-key or HEALIFY_API_KEY env var required', c.red)); process.exit(1) }

  console.log(color(`  ➜ Triggering test run for project ${project}…`, c.dim))
  if (branch) console.log(color(`    Branch: ${branch}`, c.dim))

  const { status, data } = await req(
    'POST',
    `${baseUrl}/api/projects/${project}/run`,
    apiKey,
    { branch }
  )

  const d = data as Record<string, unknown>
  if (status >= 200 && status < 300) {
    console.log(color(`  ✓ Test run created`, c.green))
    console.log(color(`    Run ID: ${d?.testRunId ?? d?.id ?? '—'}`, c.cyan))
    console.log(color(`    Use: healify stream --run ${d?.testRunId ?? d?.id} --api-key <key>`, c.dim))
  } else {
    console.error(color(`  ✗ Failed (${status}): ${JSON.stringify(d)}`, c.red))
    process.exit(1)
  }
}

async function cmdStatus(flags: Record<string, string>) {
  const runId = flags['run']
  const apiKey = flags['api-key'] ?? flags['apikey'] ?? process.env.HEALIFY_API_KEY
  const baseUrl = flags['url'] ?? 'https://healify-sigma.vercel.app'

  if (!runId) { console.error(color('  ✗ --run is required', c.red)); process.exit(1) }
  if (!apiKey) { console.error(color('  ✗ --api-key or HEALIFY_API_KEY env var required', c.red)); process.exit(1) }

  const { status, data } = await req('GET', `${baseUrl}/api/test-runs/${runId}`, apiKey)
  const d = data as Record<string, unknown>

  if (status >= 200 && status < 300) {
    const statusStr = String(d?.status ?? '?')
    const statusColor = {
      PASSED: c.green, HEALED: c.magenta, FAILED: c.red, PARTIAL: c.yellow,
    }[statusStr] ?? c.white

    console.log()
    console.log(color(`  Status:  ${statusStr}`, statusColor, c.bold))
    console.log(color(`  Total:   ${d?.totalTests ?? '?'}`, c.white))
    console.log(color(`  Passed:  ${d?.passedTests ?? '?'}`, c.green))
    console.log(color(`  Failed:  ${d?.failedTests ?? '?'}`, c.red))
    console.log(color(`  Healed:  ${d?.healedTests ?? '?'}`, c.magenta))
    if (d?.duration) console.log(color(`  Duration: ${(Number(d.duration) / 1000).toFixed(1)}s`, c.dim))
    console.log()
  } else {
    console.error(color(`  ✗ Failed (${status}): ${JSON.stringify(d)}`, c.red))
    process.exit(1)
  }
}

async function cmdStream(flags: Record<string, string>) {
  const runId = flags['run']
  const apiKey = flags['api-key'] ?? flags['apikey'] ?? process.env.HEALIFY_API_KEY
  const baseUrl = flags['url'] ?? 'https://healify-sigma.vercel.app'

  if (!runId) { console.error(color('  ✗ --run is required', c.red)); process.exit(1) }
  if (!apiKey) { console.error(color('  ✗ --api-key or HEALIFY_API_KEY env var required', c.red)); process.exit(1) }

  const url = new URL(`${baseUrl}/api/test-runs/${runId}/stream`)
  const mod = url.protocol === 'https:' ? https : http

  console.log(color(`  ⟳ Streaming test run ${runId}…\n`, c.dim))

  return new Promise<void>((resolve, reject) => {
    const reqObj = mod.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'text/event-stream',
        },
      },
      res => {
        const rl = readline.createInterface({ input: res })
        rl.on('line', line => {
          if (!line.startsWith('data: ')) return
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string; payload?: { progress?: number; message?: string; data?: unknown }
            }
            if (event.type === 'close' || event.type === 'completed' || event.type === 'failed') {
              const col = event.type === 'completed' ? c.green : event.type === 'failed' ? c.red : c.dim
              console.log(color(`  ${event.type.toUpperCase()}`, col, c.bold))
              rl.close()
              resolve()
              return
            }
            const progress = event.payload?.progress !== undefined ? `[${String(event.payload.progress).padStart(3)}%] ` : '       '
            const msg = event.payload?.message ?? event.type
            const typeCol = event.type === 'test_failed' ? c.red : event.type === 'test_healed' ? c.magenta : c.dim
            console.log(color(`  ${progress}${msg}`, typeCol))
          } catch {}
        })
        rl.on('close', () => resolve())
        res.on('error', reject)
      }
    )
    reqObj.on('error', reject)
    reqObj.end()
  })
}

function cmdHelp() {
  printBanner()
  console.log('  ' + color('Usage:', c.bold))
  console.log()
  console.log(`    healify ${color('trigger', c.cyan)} --project <id> --api-key <key> [--branch <branch>]`)
  console.log(`    healify ${color('status', c.cyan)}  --run <runId>  --api-key <key>`)
  console.log(`    healify ${color('stream', c.cyan)}  --run <runId>  --api-key <key>`)
  console.log()
  console.log('  ' + color('Options:', c.bold))
  console.log(`    --project    Project ID from your Healify dashboard`)
  console.log(`    --run        Test Run ID to inspect or stream`)
  console.log(`    --api-key    Your Healify API key (or set HEALIFY_API_KEY env var)`)
  console.log(`    --branch     Git branch to test (default: default branch)`)
  console.log(`    --url        Healify base URL (default: https://healify-sigma.vercel.app)`)
  console.log()
  console.log('  ' + color('Examples:', c.bold))
  console.log(`    HEALIFY_API_KEY=hf_xxx healify trigger --project proj_abc --branch main`)
  console.log(`    healify stream --run run_xyz --api-key hf_xxx`)
  console.log()
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { command, flags } = parseArgs(process.argv)

  try {
    switch (command) {
      case 'trigger': await cmdTrigger(flags); break
      case 'status':  await cmdStatus(flags); break
      case 'stream':  await cmdStream(flags); break
      case 'help':
      default:        cmdHelp(); break
    }
  } catch (err) {
    console.error(color(`  ✗ Unexpected error: ${err instanceof Error ? err.message : String(err)}`, c.red))
    process.exit(1)
  }
}

main()
