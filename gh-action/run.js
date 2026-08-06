import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createClient } from './github-api.js'

const MARKER = '<!-- healify-report -->'

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

  // Check if we're in a PR context
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
