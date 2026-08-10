import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from './github-api.js'
import { parseTestLog } from './log-parser.js'
import { buildRunFromHealResults } from './report-builder.js'

const MARKER = '<!-- healify-report -->'

/** Rama de la PR auto-generada — mismo patrón de timestamp que usa el CLI en `cli/src/pr.ts`. */
function branchName() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `healify/fix-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/** Corre `git` con cwd=projectPath y devuelve `{ ok, output }` (misma convención que `run`). */
function git(cwd, ...args) {
  return run(`git ${args.join(' ')}`, cwd)
}

/**
 * Corre un comando y devuelve `{ ok, output }`.
 *
 * Antes devolvía un string pelado y en el catch devolvía el texto del error, indistinguible
 * de una salida exitosa. Eso producía el peor resultado posible: si el CLI no llegaba a
 * correr, su mensaje de error no traía ningún marcador ✅/❌/✓/⚠, buildComment no encontraba
 * nada que reportar y concluía "All Clear ✅ — No broken selectors detected". La Action decía
 * que estaba todo bien sobre una corrida que nunca ocurrió.
 *
 * No se relanza el error a propósito: un fallo del CLI tiene que terminar en un comentario
 * que lo diga, no en un job rojo sin explicación. Pero el que llama necesita poder
 * distinguirlo, y para eso está `ok`.
 */
export function run(cmd, cwd = '.') {
  try {
    return { ok: true, output: execSync(cmd, { encoding: 'utf-8', timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'], cwd }).trim() }
  } catch (err) {
    const stderr = err.stderr?.toString() || ''
    const stdout = err.stdout?.toString() || ''
    return { ok: false, output: (stdout || stderr || err.message || '').trim() }
  }
}

export function formatDoctor(output) {
  const lines = output.split('\n').filter(Boolean)
  const checks = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('✅')) checks.push({ icon: '✅', text: trimmed.slice(2).trim() })
    else if (trimmed.startsWith('❌')) checks.push({ icon: '❌', text: trimmed.slice(2).trim() })
    else if (trimmed.startsWith('ℹ️')) checks.push({ icon: 'ℹ️', text: trimmed.slice(3).trim() })
    else if (trimmed.startsWith('fix:')) {
      if (checks.length > 0) checks[checks.length - 1].fix = trimmed.slice(4).trim()
    }
  }
  return checks
}

export function formatFixOutput(output) {
  const lines = output.split('\n').filter(Boolean)
  const applied = []
  const skipped = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('✓')) applied.push(trimmed.slice(2).trim())
    else if (trimmed.startsWith('⚠')) skipped.push(trimmed.slice(2).trim())
  }

  return { applied, skipped }
}

/** Primeras líneas útiles de la salida de un comando que falló, para el bloque de diagnóstico. */
function errorExcerpt(output) {
  return output.split('\n').filter((l) => l.trim()).slice(0, 6).join('\n').slice(0, 800)
}

export function buildComment(doctorOutput, fixOutput, opts = {}) {
  const { doctorOk = true, fixOk = true } = opts

  // Si un comando no llegó a correr, no hay nada que interpretar: su salida es un mensaje de
  // error, no un reporte. Decirlo es obligatorio — el silencio acá se leía como "All Clear",
  // que es la afirmación más fuerte que puede hacer la Action y era exactamente la falsa.
  if (!doctorOk || !fixOk) {
    const cuales = [!doctorOk && 'healify doctor', !fixOk && 'healify fix --dry-run'].filter(Boolean).join(' and ')
    const salida = errorExcerpt(!doctorOk ? doctorOutput : fixOutput)
    return [
      `${MARKER}`,
      '',
      '### Healify — Could not run ⚠️',
      '',
      `\`${cuales}\` failed to run, so **this PR was not checked**. This is not a pass.`,
      '',
      'Most likely `@healify/cli` is not installed or reachable in this project. Check that your',
      'workflow installs dependencies before this action, and that `project-path` points at the',
      'directory holding your test project.',
      '',
      '<details><summary>Command output</summary>',
      '',
      '```',
      salida || '(no output)',
      '```',
      '',
      '</details>',
    ].join('\n')
  }

  const checks = formatDoctor(doctorOutput)
  const { applied, skipped } = formatFixOutput(fixOutput)

  const hasFailures = checks.some((c) => c.icon === '❌')
  const hasBrokenSelectors = applied.length > 0 || skipped.length > 0
  const hasInfo = checks.some((c) => c.icon === 'ℹ️')

  if (!hasFailures && !hasBrokenSelectors && !hasInfo) {
    return `${MARKER}\n\n### Healify — All Clear ✅\n\nNo broken selectors detected. Healify doctor passed all checks.`
  }

  const header = hasFailures || hasBrokenSelectors ? '### Healify — Issues Detected ❌\n' : '### Healify — Info\n'
  const parts = [`${MARKER}\n\n${header}`]

  // Doctor failures
  const failures = checks.filter((c) => c.icon === '❌')
  if (failures.length > 0) {
    parts.push('#### Setup Issues\n')
    for (const f of failures) {
      parts.push(`- ❌ **${f.text}**`)
      if (f.fix) parts.push(`  - Fix: \`${f.fix}\``)
    }
    parts.push('')
  }

  // Broken selectors from fix --dry-run
  if (applied.length > 0) {
    parts.push(`#### Suggested Fixes (${applied.length})\n`)
    parts.push('| File | Original | Suggested |')
    parts.push('|------|----------|-----------|')
    for (const entry of applied) {
      const [file, rest] = splitEntry(entry)
      const [original, suggested] = (rest || '').split(' → ').map((s) => s?.trim())
      parts.push(`| \`${file}\` | \`${original}\` | \`${suggested}\` |`)
    }
    parts.push('')
  }

  if (skipped.length > 0) {
    parts.push(`#### Needs Review (${skipped.length})\n`)
    for (const entry of skipped) {
      parts.push(`- ⚠️ ${entry}`)
    }
    parts.push('')
  }

  // Info checks
  const infos = checks.filter((c) => c.icon === 'ℹ️')
  if (infos.length > 0) {
    parts.push('#### Notes\n')
    for (const info of infos) {
      parts.push(`- ℹ️ ${info.text}`)
    }
    parts.push('')
  }

  parts.push(`\n<sub>Run Healify locally to apply fixes: \`npx @healify/cli fix\`</sub>`)

  return parts.join('\n')
}

function splitEntry(entry) {
  const idx = entry.indexOf(' — ')
  if (idx === -1) return [entry, '']
  return [entry.slice(0, idx), entry.slice(idx + 3)]
}

/** `healify heal` — el motor vía stdin JSON, para curar cada selector extraído del log.
 * Devuelve `{ ok, output }` con `output` en shape `HealCommandOutput`, o `{ ok: false, error }`. */
export function runHeal(selector, testFile, errorMessage, cwd = '.') {
  const payload = JSON.stringify({ selector, testFile, errorMessage })
  try {
    const output = execSync('npx @healify/cli heal', {
      input: payload,
      encoding: 'utf-8',
      timeout: 60_000,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    }).trim()
    return { ok: true, output: JSON.parse(output) }
  } catch (err) {
    const stdout = err.stdout?.toString() || ''
    const stderr = err.stderr?.toString() || ''
    let parsed = null
    try {
      parsed = JSON.parse(stdout.trim())
    } catch {
      // no era JSON: quedan stdout/stderr para el mensaje
    }
    const detail = parsed?.error || (stdout || stderr || err.message || '').trim()
    return { ok: false, error: detail }
  }
}

/**
 * `fail_on_unsupported`: cuando Healify no pudo hacer su trabajo (no hay log, no se extrajo
 * ningún selector, o el CLI falló), el usuario puede pedir que el job falle para que el
 * problema no pase en silencio en un cron. Default false: se registra y se sigue.
 */
function handleUnsupported(failOnUnsupported, message) {
  if (failOnUnsupported) {
    console.log(message)
    process.exit(1)
  }
  console.log(message)
}

function projectName() {
  return (process.env.GITHUB_REPOSITORY || '').split('/')[1] || 'project'
}

/** Fila de la tabla de cambios desde una entrada `✓ file — original → fixed` del fix. */
function changeRow(entry) {
  const [file, rest] = splitEntry(entry)
  const [original, fixed] = (rest || '').split(' → ').map((s) => s?.trim())
  return { file, original, fixed }
}

/** Body de la PR auto-generada: resumen + tabla con cada cambio + lo que quedó para revisión. */
export function buildAutoPrBody(applied, skipped, framework, baseBranch) {
  const rows = applied.map((entry) => {
    const { file, original, fixed } = changeRow(entry)
    return `| \`${file}\` | \`${original}\` | \`${fixed}\` |`
  })

  const parts = [
    `## Healify Auto-Fix`,
    ``,
    `Se detectaron ${applied.length} selector${applied.length === 1 ? '' : 'es'} roto${applied.length === 1 ? '' : 's'} en el log de tests y se aplicaron las correcciones automáticamente (${framework}).`,
    ``,
    `### Cambios`,
    `| Archivo | Original | Corregido |`,
    `|---------|----------|-----------|`,
    ...rows,
  ]

  if (skipped.length > 0) {
    parts.push(
      ``,
      `### Para revisión manual (${skipped.length})`,
      ...skipped.map((s) => `- ⚠️ ${s}`)
    )
  }

  parts.push(
    ``,
    `> Abierta automáticamente por Healify desde \`${baseBranch}\`. Revisá los cambios antes de mergear.`
  )
  return parts.join('\n')
}

/** Comentario que deja Healify en la PR explicando cada cambio (con el marcador para no apilar). */
export function buildAutoPrComment(applied, skipped, framework) {
  const rows = applied.map((entry) => {
    const { file, original, fixed } = changeRow(entry)
    return `| \`${file}\` | \`${original}\` | \`${fixed}\` |`
  })

  const parts = [
    `${MARKER}`,
    ``,
    `### Healify — Auto-Fix ${framework}`,
    ``,
    `| Archivo | Original | Corregido |`,
    `|---------|----------|-----------|`,
    ...rows,
  ]

  if (skipped.length > 0) {
    parts.push(``, `⚠️ ${skipped.length} quedaron para revisión manual (no se tocaron).`)
  }

  return parts.join('\n')
}

/** Aplica los fixes reales (no dry-run) sobre el reporte armado y devuelve `{ applied, skipped }`. */
function applyFixes(projectPath, reportPath) {
  const fix = run(`npx @healify/cli fix ${reportPath}`, projectPath)
  return formatFixOutput(fix.output)
}

/**
 * Flujo para `workflow_dispatch` / `schedule` (y cualquier evento sin PR de origen):
 * log → selectores → heal por selector → reporte → `healify fix` real → branch + PR + comentario.
 */
async function runAutoPrFlow(token, projectPath) {
  const autoPr = (process.env.INPUT_AUTO_PR ?? 'true') !== 'false'
  const failOnUnsupported = (process.env.INPUT_FAIL_ON_UNSUPPORTED ?? 'false') === 'true'
  const labels = (process.env.INPUT_LABELS || '').split(',').map((s) => s.trim()).filter(Boolean)
  const testLogPath = process.env.INPUT_TEST_LOG_PATH

  if (!testLogPath) {
    handleUnsupported(failOnUnsupported, 'No test-log-path input provided — nothing to analyze.')
    return
  }

  const fullLogPath = join(projectPath, testLogPath)
  let logText
  try {
    logText = readFileSync(fullLogPath, 'utf-8')
  } catch {
    handleUnsupported(failOnUnsupported, `Cannot read test log at ${fullLogPath} — nothing to analyze.`)
    return
  }

  const { framework, cases } = parseTestLog(logText)
  if (cases.length === 0) {
    handleUnsupported(failOnUnsupported, 'No broken selectors found in the test log — nothing to fix.')
    return
  }
  console.log(`Found ${cases.length} broken selector${cases.length === 1 ? '' : 's'} in the test log (${framework}).`)

  // Curar cada selector con el motor (vía `healify heal`). Un fallo puntual no aborta el
  // resto: ese caso queda como unresolved en el reporte y se ve en el comentario.
  const healResults = cases.map((c) => runHeal(c.selector, c.testFile, c.errorMessage, projectPath))
  const report = buildRunFromHealResults(cases, healResults, { project: projectName(), framework })

  const reportPath = join(projectPath, 'healify-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  const { applied, skipped } = applyFixes(projectPath, reportPath)
  console.log(`${applied.length} fix${applied.length === 1 ? '' : 'es'} aplicado${applied.length === 1 ? '' : 's'}, ${skipped.length} salteado${skipped.length === 1 ? '' : 's'}.`)

  if (!autoPr) {
    console.log('auto-pr is false — fixes applied locally, no PR opened.')
    return
  }
  if (applied.length === 0) {
    console.log('No fixes could be applied automatically — no PR opened.')
    return
  }

  const repoFull = process.env.GITHUB_REPOSITORY || ''
  const [owner, repo] = repoFull.split('/')
  if (!owner || !repo) {
    console.log('GITHUB_REPOSITORY not set — cannot open a PR.')
    return
  }

  const branch = branchName()
  const base = process.env.GITHUB_REF_NAME || 'main'
  const client = createClient(token)

  const checkout = git(projectPath, 'checkout', '-b', branch)
  if (!checkout.ok) {
    console.log(`Failed to create branch '${branch}': ${checkout.output}`)
    process.exit(1)
  }

  // Identidad para el commit — el runner no tiene user.name/user.email configurados.
  git(projectPath, 'config', 'user.name', 'github-actions[bot]')
  git(projectPath, 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')

  git(projectPath, 'add', '-A')
  const commit = git(projectPath, 'commit', '-m', `healify: auto-fix ${applied.length} broken selector${applied.length === 1 ? '' : 's'}`)
  if (!commit.ok) {
    console.log(`Commit failed: ${commit.output}`)
    process.exit(1)
  }

  const push = git(projectPath, 'push', '-u', 'origin', branch)
  if (!push.ok) {
    console.log(`Push failed — is the token missing 'contents: write'? ${push.output}`)
    process.exit(1)
  }

  const title = `healify: auto-fix ${applied.length} broken selector${applied.length === 1 ? '' : 's'}`
  const pr = await client.createPullRequest(owner, repo, {
    title,
    body: buildAutoPrBody(applied, skipped, framework, base),
    head: branch,
    base,
  })

  if (labels.length > 0) await client.addLabels(owner, repo, pr.number, labels)

  const comment = buildAutoPrComment(applied, skipped, framework)
  await postComment(client, owner, repo, pr.number, comment)

  console.log(`Healify PR created: ${pr.html_url || `#${pr.number}`}`)
}

/** El comentario que ya dejó Healify en esta PR, reconocido por el marcador HTML invisible. */
export async function findOrCreateComment(client, owner, repo, issueNumber) {
  const comments = await client.listComments(owner, repo, issueNumber)
  return comments.find((c) => c.body?.includes(MARKER))
}

/** Actualiza el comentario existente en vez de apilar uno nuevo por cada push a la PR. */
export async function postComment(client, owner, repo, issueNumber, body) {
  const existing = await findOrCreateComment(client, owner, repo, issueNumber)
  if (existing) {
    await client.updateComment(owner, repo, existing.id, body)
    return 'updated'
  }
  await client.createComment(owner, repo, issueNumber, body)
  return 'created'
}

async function main() {
  const token = process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN
  const projectPath = process.env.INPUT_PROJECT_PATH || '.'

  if (!token) {
    console.log('No GitHub token found, skipping PR comment.')
    return
  }

  const eventName = process.env.GITHUB_EVENT_NAME

  // workflow_dispatch / schedule (y cualquier evento sin PR de origen): el flujo nuevo, log → PR.
  if (eventName && eventName !== 'pull_request') {
    await runAutoPrFlow(token, projectPath)
    return
  }

  // Evento pull_request: flujo clásico, comentario con doctor + fix --dry-run.
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath) {
    console.log('Not in a GitHub Actions context, skipping.')
    return
  }

  const event = JSON.parse(readFileSync(eventPath, 'utf-8'))
  const prNumber = event.pull_request?.number
  if (!prNumber) {
    console.log('Not a pull request event, skipping.')
    return
  }

  const repoFull = process.env.GITHUB_REPOSITORY || ''
  const [owner, repo] = repoFull.split('/')

  // Run Healify
  console.log(`Running Healify doctor in '${projectPath}'...`)
  const doctor = run(`npx @healify/cli doctor`, projectPath)
  if (!doctor.ok) console.log('healify doctor failed — the PR comment will say so instead of reporting a pass.')

  // --record-history acumula .healify/history.jsonl entre corridas sin tocar ni un archivo de
  // test. Sin esto la Action no deja rastro y el historial restaurado del cache estaría siempre
  // vacío: "este selector se rompió 5 veces" nunca podría afirmarse desde CI.
  console.log(`Running Healify fix --dry-run in '${projectPath}'...`)
  const fix = run(`npx @healify/cli fix --dry-run --record-history`, projectPath)
  if (!fix.ok) console.log('healify fix failed — the PR comment will say so instead of reporting a pass.')

  // Build comment
  const comment = buildComment(doctor.output, fix.output, { doctorOk: doctor.ok, fixOk: fix.ok })

  const result = await postComment(createClient(token), owner, repo, prNumber, comment)
  console.log(`Healify PR comment ${result}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
