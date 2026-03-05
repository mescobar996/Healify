/**
 * Email templates HTML para Healify.
 * Diseño dark AMOLED consistente con el producto.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://healify-sigma.vercel.app'

// ─── Layout wrapper ──────────────────────────────────────────────────
function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Healify</title>
</head>
<body style="margin:0;padding:0;background:#0A0E1A;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E1A;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0D1117;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

  <!-- Header -->
  <tr><td style="padding:20px 28px;background:linear-gradient(135deg,rgba(0,245,200,0.08),rgba(123,94,248,0.12));border-bottom:1px solid rgba(255,255,255,0.06);">
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#00F5C8;">HEALIFY</span>
    <span style="font-size:12px;color:rgba(232,240,255,0.35);margin-left:8px;">· Tests that heal themselves</span>
  </td></tr>

  <!-- Content -->
  <tr><td style="padding:28px;">
    ${content}
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.01);">
    <p style="margin:0;font-size:11px;color:rgba(232,240,255,0.2);">
      Healify ·
      <a href="${BASE_URL}/dashboard" style="color:#00F5C8;text-decoration:none;">Ver dashboard</a> ·
      <a href="${BASE_URL}/dashboard/settings" style="color:rgba(232,240,255,0.2);text-decoration:none;">Gestionar notificaciones</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

// ─── Code block ──────────────────────────────────────────────────────
function code(text: string): string {
  return `<code style="font-family:'Courier New',monospace;font-size:12px;background:rgba(255,255,255,0.06);color:#00F5C8;padding:2px 6px;border-radius:4px;word-break:break-all;">${text}</code>`
}

// ─── Badge ───────────────────────────────────────────────────────────
function badge(text: string, color: string, bg: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:${color};background:${bg};border:1px solid ${color}30;">${text}</span>`
}

// ════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — Test Healed (el más importante)
// ════════════════════════════════════════════════════════════════════
export function emailTestHealed(opts: {
  testName:     string
  projectName:  string
  oldSelector:  string
  newSelector:  string
  confidence:   number
  selectorType: string
  healingId?:   string
  prUrl?:       string
}): { subject: string; html: string } {
  const confPct  = Math.round(opts.confidence * 100)
  const confColor = confPct >= 95 ? '#00F5C8' : confPct >= 80 ? '#F59E0B' : '#EF4444'
  const healingUrl = opts.healingId
    ? `${BASE_URL}/dashboard/healing/${opts.healingId}`
    : `${BASE_URL}/dashboard`

  const content = `
    <!-- Status pill -->
    <div style="margin-bottom:20px;">
      ${badge('✨ TEST AUTOCURADO', '#00F5C8', 'rgba(0,245,200,0.08)')}
    </div>

    <!-- Title -->
    <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#E8F0FF;line-height:1.3;">
      ${opts.testName}
    </h2>
    <p style="margin:0 0 24px;font-size:13px;color:rgba(232,240,255,0.45);">
      Proyecto: <strong style="color:rgba(232,240,255,0.7);">${opts.projectName}</strong>
    </p>

    <!-- Selector diff -->
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:16px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(232,240,255,0.35);">Cambio de selector</p>

      <div style="margin-bottom:8px;">
        <span style="font-size:11px;color:#EF4444;font-weight:600;">ANTES</span><br/>
        <div style="margin-top:4px;padding:8px 10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:6px;">
          ${code(opts.oldSelector)}
        </div>
      </div>

      <div style="text-align:center;color:rgba(232,240,255,0.2);font-size:16px;padding:4px 0;">↓</div>

      <div>
        <span style="font-size:11px;color:#00F5C8;font-weight:600;">AHORA</span><br/>
        <div style="margin-top:4px;padding:8px 10px;background:rgba(0,245,200,0.06);border:1px solid rgba(0,245,200,0.2);border-radius:6px;">
          ${code(opts.newSelector)}
        </div>
      </div>
    </div>

    <!-- Meta: confidence + type -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px 14px;flex:1;">
        <p style="margin:0;font-size:10px;color:rgba(232,240,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">Confianza IA</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:${confColor};">${confPct}%</p>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:10px 14px;flex:1;">
        <p style="margin:0;font-size:10px;color:rgba(232,240,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">Tipo</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#7B5EF8;">${opts.selectorType}</p>
      </div>
      ${confPct >= 95 ? `
      <div style="background:rgba(0,245,200,0.04);border:1px solid rgba(0,245,200,0.15);border-radius:8px;padding:10px 14px;flex:1;">
        <p style="margin:0;font-size:10px;color:rgba(232,240,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">Acción</p>
        <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#00F5C8;">Auto-aplicado ✓</p>
      </div>` : `
      <div style="background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.15);border-radius:8px;padding:10px 14px;flex:1;">
        <p style="margin:0;font-size:10px;color:rgba(232,240,255,0.3);text-transform:uppercase;letter-spacing:0.08em;">Acción</p>
        <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#F59E0B;">Revisar ⚠️</p>
      </div>`}
    </div>

    ${opts.prUrl ? `
    <!-- PR link -->
    <div style="background:rgba(123,94,248,0.06);border:1px solid rgba(123,94,248,0.2);border-radius:8px;padding:12px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:rgba(232,240,255,0.6);">
        🔀 Se abrió un Pull Request automático:
        <a href="${opts.prUrl}" style="color:#7B5EF8;text-decoration:none;word-break:break-all;">${opts.prUrl}</a>
      </p>
    </div>` : ''}

    <!-- CTA -->
    <a href="${healingUrl}" style="display:inline-block;background:linear-gradient(135deg,#00F5C8,#7B5EF8);color:#0A0E1A;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">
      Ver detalle del healing →
    </a>
  `

  return {
    subject: `✨ Test autocurado: ${opts.testName} (${confPct}% confianza)`,
    html:    layout(content),
  }
}

// ════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — Test falló sin curación
// ════════════════════════════════════════════════════════════════════
export function emailTestFailed(opts: {
  testName:    string
  projectName: string
  errorMessage: string
  testRunId?:  string
}): { subject: string; html: string } {
  const runUrl = opts.testRunId
    ? `${BASE_URL}/dashboard/tests/${opts.testRunId}`
    : `${BASE_URL}/dashboard/tests`

  const content = `
    <div style="margin-bottom:20px;">
      ${badge('❌ TEST FALLIDO SIN CURACIÓN', '#EF4444', 'rgba(239,68,68,0.08)')}
    </div>

    <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#E8F0FF;">
      ${opts.testName}
    </h2>
    <p style="margin:0 0 24px;font-size:13px;color:rgba(232,240,255,0.45);">
      Proyecto: <strong style="color:rgba(232,240,255,0.7);">${opts.projectName}</strong>
    </p>

    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(239,68,68,0.6);">Error</p>
      <p style="margin:0;font-size:13px;color:rgba(232,240,255,0.6);line-height:1.5;word-break:break-word;">
        ${opts.errorMessage.slice(0, 300)}${opts.errorMessage.length > 300 ? '...' : ''}
      </p>
    </div>

    <p style="margin:0 0 20px;font-size:13px;color:rgba(232,240,255,0.5);line-height:1.6;">
      La IA no pudo encontrar una alternativa confiable para este selector. 
      Revisá el test manualmente desde el dashboard.
    </p>

    <a href="${runUrl}" style="display:inline-block;background:rgba(239,68,68,0.15);color:#EF4444;border:1px solid rgba(239,68,68,0.3);font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">
      Revisar test fallido →
    </a>
  `

  return {
    subject: `❌ Test fallido: ${opts.testName} — revisión manual requerida`,
    html:    layout(content),
  }
}

// ════════════════════════════════════════════════════════════════════
// TEMPLATE 3 — Bienvenida (ya existe, pero la centralizamos acá)
// ════════════════════════════════════════════════════════════════════
export function emailWelcome(opts: {
  name?: string
}): { subject: string; html: string } {
  const firstName = opts.name?.split(' ')[0] || 'QA Engineer'

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#E8F0FF;">
      ¡Bienvenido a Healify, ${firstName}! 🎉
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(232,240,255,0.5);line-height:1.6;">
      Tus tests van a empezar a curarse solos. Esto es lo que podés hacer hoy:
    </p>

    ${[
      { n: '1', title: 'Conectá tu repositorio', desc: 'Agregá el webhook de GitHub en tu proyecto', href: `${BASE_URL}/dashboard/projects` },
      { n: '2', title: 'Instalá el reporter', desc: 'npm install @healify/playwright-reporter --save-dev', href: `${BASE_URL}/docs#installation` },
      { n: '3', title: 'Mirá el dashboard', desc: 'Cuando un test falle, Healify lo curará solo', href: `${BASE_URL}/dashboard` },
    ].map(s => `
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:16px;">
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7B5EF8,#00F5C8);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:13px;font-weight:800;color:#0A0E1A;">${s.n}</span>
        </div>
        <div>
          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#E8F0FF;">${s.title}</p>
          <p style="margin:0;font-size:12px;color:rgba(232,240,255,0.4);">${s.desc}</p>
        </div>
      </div>
    `).join('')}

    <div style="margin-top:24px;">
      <a href="${BASE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#00F5C8,#7B5EF8);color:#0A0E1A;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">
        Ir al dashboard →
      </a>
      <a href="${BASE_URL}/docs" style="display:inline-block;margin-left:12px;color:rgba(232,240,255,0.5);font-size:13px;text-decoration:none;">
        Ver documentación
      </a>
    </div>
  `

  return {
    subject: `¡Bienvenido a Healify! Tus tests van a curarse solos 🚀`,
    html:    layout(content),
  }
}
