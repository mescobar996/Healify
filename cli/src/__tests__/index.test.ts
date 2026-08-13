import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockDoctor: vi.fn(),
  mockHistory: vi.fn(),
  mockRunHeal: vi.fn(),
  mockReadHealStats: vi.fn(),
  mockFormatStats: vi.fn(),
  mockRunExplain: vi.fn(),
  mockRunFix: vi.fn(),
  mockRunReport: vi.fn(),
  mockRunDashboard: vi.fn(),
  mockRunDashboardServe: vi.fn(),
  mockRunFlake: vi.fn(),
  mockGetVersion: vi.fn(),
  mockRunAiSetup: vi.fn((): Promise<void> => Promise.resolve()),
  mockRunAiStatus: vi.fn((): Promise<void> => Promise.resolve()),
  mockRunAiExplain: vi.fn((): Promise<void> => Promise.resolve()),
  mockRunAiChat: vi.fn((): Promise<void> => Promise.resolve()),
  mockRunAiModels: vi.fn((): Promise<void> => Promise.resolve()),
  mockRunConfirm: vi.fn(),
}))

vi.mock('../commands/init', () => ({
  init: mocks.mockInit,
  HEALIFY_SCRIPTS: [
    { name: 'healify', command: 'healify fix' },
    { name: 'healify:dry', command: 'healify fix --dry-run' },
    { name: 'healify:dashboard', command: 'healify dashboard --serve' },
  ],
}))
vi.mock('../commands/doctor', () => ({ doctor: mocks.mockDoctor }))
vi.mock('../commands/history', () => ({ history: mocks.mockHistory }))
vi.mock('../commands/heal', () => ({
  runHeal: mocks.mockRunHeal,
  readHealStats: mocks.mockReadHealStats,
  formatHealStatsSummary: mocks.mockFormatStats,
}))
vi.mock('../commands/explain', () => ({ runExplain: mocks.mockRunExplain }))
vi.mock('../commands/fix-pr', () => ({ runFix: mocks.mockRunFix }))
vi.mock('../commands/report', () => ({ runReport: mocks.mockRunReport }))
vi.mock('../commands/dashboard', () => ({
  runDashboard: mocks.mockRunDashboard,
  runDashboardServe: mocks.mockRunDashboardServe,
}))
vi.mock('../commands/flake', () => ({ runFlake: mocks.mockRunFlake }))
vi.mock('../commands/confirm', () => ({ runConfirm: mocks.mockRunConfirm }))
vi.mock('../version', () => ({ getVersion: mocks.mockGetVersion }))
vi.mock('../commands/ai', () => ({
  runAiSetup: mocks.mockRunAiSetup,
  runAiStatus: mocks.mockRunAiStatus,
  runAiExplain: mocks.mockRunAiExplain,
  runAiChat: mocks.mockRunAiChat,
  runAiModels: mocks.mockRunAiModels,
}))

import { runCli } from '../index'

let log: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>
const unhandled: Array<() => void> = []

function swallowUnhandled(): void {
  const fn = () => {}
  process.on('unhandledRejection', fn)
  unhandled.push(() => process.off('unhandledRejection', fn))
}

beforeEach(() => {
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`PROCESS_EXIT:${code ?? ''}`)
  }) as typeof process.exit)
  vi.clearAllMocks()
  mocks.mockGetVersion.mockReturnValue('9.9.9-test')
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const off of unhandled.splice(0)) off()
})

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10))
}

describe('flags globales', () => {
  it('--version imprime la versión y no ejecuta nada', () => {
    runCli(['--version'])
    expect(log).toHaveBeenCalledWith('9.9.9-test')
    expect(mocks.mockInit).not.toHaveBeenCalled()
  })

  it('-v en cualquier posición imprime la versión', () => {
    runCli(['fix', '-v'])
    expect(log).toHaveBeenCalledWith('9.9.9-test')
    expect(mocks.mockRunFix).not.toHaveBeenCalled()
  })

  it('--help imprime el uso', () => {
    runCli(['--help'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Uso: healify <comando>'))
  })

  it('-h en cualquier posición imprime el uso sin ejecutar nada', () => {
    runCli(['init', '-h'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Uso: healify <comando>'))
    expect(mocks.mockInit).not.toHaveBeenCalled()
  })
})

describe('init', () => {
  beforeEach(() => {
    mocks.mockDoctor.mockReturnValue({ checks: [] })
  })

  it('imprime el reporte de init con todos los estados y frameworks', () => {
    mocks.mockInit.mockReturnValue({
      frameworks: [],
      prompted: true,
      results: [
        { framework: 'selenium', package: 'selenium-webdriver', installed: 'already-installed', config: 'already-wired', ext: 'ts', moduleType: 'esm' },
        { framework: 'webdriverio', package: '@wdio/cli', installed: 'installed', config: 'edited', ext: 'ts', moduleType: 'esm' },
        { framework: 'playwright', package: '@playwright/test', installed: 'install-failed', config: 'no-config-found', ext: 'js', moduleType: 'cjs' },
        { framework: 'cypress', package: 'cypress', installed: 'installed', config: 'scaffolded', scaffoldedFiles: ['cypress.config.ts'], ext: 'ts', moduleType: 'esm' },
        { framework: 'cypress', package: 'cypress', installed: 'installed', config: 'scaffolded', ext: 'ts', moduleType: 'esm' },
        { framework: 'playwright', package: '@playwright/test', installed: 'installed', config: 'unknown', ext: 'ts', moduleType: 'esm' },
      ],
    })

    runCli(['init'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Healify init'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ya estaba instalado'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('instalado'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No pudimos instalar'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('archivos creados'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ya tenía todos los archivos'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('no encontramos el config'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('una forma que no reconocemos'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Ver healify.selenium.example.ts'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Ver healify.wdio.example.ts'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining("const { test, expect } = require('@playwright/test')"))
    expect(log).toHaveBeenCalledWith(expect.stringContaining("import { test, expect } from '@playwright/test'"))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('cy.get('))
  })

  it('imprime los pasos numerados y el cierre accionable', () => {
    mocks.mockInit.mockReturnValue({
      frameworks: ['playwright'],
      prompted: false,
      detected: [{ framework: 'playwright', evidence: ['@playwright/test', 'playwright.config.ts'] }],
      scriptsAdded: ['healify', 'healify:dry', 'healify:dashboard'],
      results: [{ framework: 'playwright', package: '@healify/test-runner', installed: 'installed', config: 'edited', ext: 'ts', moduleType: 'esm' }],
    })

    runCli(['init'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('1/4 Detectando tu framework'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('2/4 Instalando'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('3/4 Conectando Healify'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('4/4 Scripts en tu package.json'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('@playwright/test · playwright.config.ts'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"healify:dashboard": healify dashboard --serve'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('npm run healify'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Healify no te genera tests'))
    expect(mocks.mockDoctor).toHaveBeenCalled()
  })

  it('--dry-run imprime el plan sin estados de instalación', () => {
    mocks.mockInit.mockReturnValue({
      frameworks: ['playwright'],
      prompted: false,
      dryRun: true,
      detected: [{ framework: 'playwright', evidence: ['@playwright/test'] }],
      results: [],
      scriptsAdded: [],
      plan: {
        install: ['@healify/test-runner (npm install --save-dev @healify/test-runner)'],
        configs: ['playwright.config.ts (inyectar marcador Healify)'],
        scripts: ['healify', 'healify:dashboard'],
      },
    })

    runCli(['init', '--dry-run'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Healify init --dry-run'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('nada se escribió'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('npm install --save-dev @healify/test-runner'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('inyectar marcador Healify'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"healify:dashboard": healify dashboard --serve'))
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('2/4 Instalando'))
    expect(mocks.mockDoctor).not.toHaveBeenCalled()
  })

  it('pasa --dry-run como opción a init()', () => {
    mocks.mockInit.mockReturnValue({ frameworks: [], prompted: false, results: [], dryRun: true, plan: { install: [], configs: [], scripts: [] } })
    runCli(['init', '--dry-run'])
    expect(mocks.mockInit).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ dryRun: true }))
  })

  it('sin prompt previo no imprime la línea de framework elegido', () => {
    mocks.mockInit.mockReturnValue({ frameworks: [], prompted: false, results: [] })
    runCli(['init'])
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('No detectamos ningún framework'))
  })
})

describe('doctor', () => {
  it('imprime checks con íconos y fixes', () => {
    mocks.mockDoctor.mockReturnValue({
      checks: [
        { label: 'paquete instalado', ok: true },
        { label: 'config ok', ok: true, info: 'usando defaults' },
        { label: 'config roto', ok: false, fix: 'corré init' },
      ],
    })
    runCli(['doctor'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Healify doctor'))
    expect(log).toHaveBeenCalledWith('✅ paquete instalado')
    expect(log).toHaveBeenCalledWith('ℹ️ config ok')
    expect(log).toHaveBeenCalledWith('❌ config roto')
    expect(log).toHaveBeenCalledWith('   fix: corré init')
  })
})

describe('fix', () => {
  it('pasa el argv completo a runFix', () => {
    runCli(['fix', 'reporte.json', '--dry-run'])
    expect(mocks.mockRunFix).toHaveBeenCalledWith(['fix', 'reporte.json', '--dry-run'])
  })
})

describe('history', () => {
  it('sin historial: mensaje para correr fix', () => {
    mocks.mockHistory.mockReturnValue({ hasHistory: false, topRecurrent: [], rebroken: [], chronic: [] })
    runCli(['history'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Todavía no hay historial'))
  })

  it('con historial: crónicos, recurrentes y re-rotos', () => {
    mocks.mockHistory.mockReturnValue({
      hasHistory: true,
      chronic: [
        { selector: '#btn-viejo', testFile: 'a.spec.ts', recommendation: 'reemplazalo por rol' },
        { selector: '#sin-archivo', recommendation: 'borralo' },
      ],
      topRecurrent: [{ count: 4, selector: '#btn-viejo' }],
      rebroken: [
        { count: 2, selector: '#otro', firstHealedAt: '2026-08-01' },
      ],
    })
    runCli(['history'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Selectores crónicos'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('#btn-viejo'))
    expect(log).toHaveBeenCalledWith('    reemplazalo por rol')
    expect(log).toHaveBeenCalledWith('  4x  #btn-viejo')
    expect(log).toHaveBeenCalledWith('  2x  #otro (curado por primera vez 2026-08-01)')
  })

  it('con historial sin re-rotos: imprime "ninguno todavía"', () => {
    mocks.mockHistory.mockReturnValue({ hasHistory: true, chronic: [], topRecurrent: [], rebroken: [] })
    runCli(['history'])
    expect(log).toHaveBeenCalledWith('  ninguno todavía')
  })
})

describe('report', () => {
  it('imprime las líneas del reporte cuando ok', async () => {
    mocks.mockRunReport.mockResolvedValue({ ok: true, lines: ['✅ 1 creado'] })
    runCli(['report'])
    await flush()
    expect(mocks.mockRunReport).toHaveBeenCalledWith([])
    expect(log).toHaveBeenCalledWith('✅ 1 creado')
  })

  it('sale con 1 cuando el reporte no es ok', async () => {
    swallowUnhandled()
    mocks.mockRunReport.mockResolvedValue({ ok: false, lines: ['falló'] })
    runCli(['report'])
    await flush()
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('dashboard', () => {
  it('imprime las líneas cuando ok', () => {
    mocks.mockRunDashboard.mockReturnValue({ ok: true, lines: ['resumen'] })
    runCli(['dashboard'])
    expect(log).toHaveBeenCalledWith('resumen')
  })

  it('sale con 1 cuando no es ok', () => {
    mocks.mockRunDashboard.mockReturnValue({ ok: false, lines: ['sin datos'] })
    expect(() => runCli(['dashboard'])).toThrow('PROCESS_EXIT:1')
  })

  it('--serve delega al servidor y registra shutdown cuando hay close', async () => {
    vi.spyOn(process, 'on').mockImplementation(() => process)
    mocks.mockRunDashboardServe.mockResolvedValue({ ok: true, lines: ['server up'], close: async () => {} })
    runCli(['dashboard', '--serve'])
    await flush()
    expect(mocks.mockRunDashboardServe).toHaveBeenCalledWith(['--serve'])
    expect(log).toHaveBeenCalledWith('server up')
  })

  it('--serve sin close no registra handlers y sigue', async () => {
    mocks.mockRunDashboardServe.mockResolvedValue({ ok: true, lines: ['server up'] })
    runCli(['dashboard', '--serve'])
    await flush()
    expect(log).toHaveBeenCalledWith('server up')
  })

  it('--serve con fallo sale con 1', async () => {
    swallowUnhandled()
    mocks.mockRunDashboardServe.mockResolvedValue({ ok: false, lines: ['puerto ocupado'] })
    runCli(['dashboard', '--serve'])
    await flush()
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('flake', () => {
  it('imprime las líneas cuando ok', () => {
    mocks.mockRunFlake.mockReturnValue({ ok: true, lines: ['0 flaky'] })
    runCli(['flake', '--min-runs', '3'])
    expect(mocks.mockRunFlake).toHaveBeenCalledWith(['--min-runs', '3'])
    expect(log).toHaveBeenCalledWith('0 flaky')
  })

  it('sale con 1 cuando no es ok', () => {
    mocks.mockRunFlake.mockReturnValue({ ok: false, lines: ['sin corridas'] })
    expect(() => runCli(['flake'])).toThrow('PROCESS_EXIT:1')
  })
})

describe('explain', () => {
  it('imprime humanText cuando ok', () => {
    mocks.mockRunExplain.mockReturnValue({ ok: true, humanText: 'Selector: #x' })
    runCli(['explain', '#x'])
    expect(mocks.mockRunExplain).toHaveBeenCalledWith(['#x'])
    expect(log).toHaveBeenCalledWith('Selector: #x')
  })

  it('imprime el error en stderr y sale con 1 cuando falla', () => {
    mocks.mockRunExplain.mockReturnValue({ ok: false, error: 'No hay selector' })
    expect(() => runCli(['explain'])).toThrow('PROCESS_EXIT:1')
    expect(error).toHaveBeenCalledWith('No hay selector')
  })
})

describe('heal', () => {
  it('lee JSON de stdin y devuelve el output por stdout', async () => {
    mocks.mockRunHeal.mockReturnValue({ ok: true, output: { fixedSelector: '#nuevo' } })
    runCli(['heal'])
    process.stdin.emit('data', Buffer.from('{"selector":"#viejo"}'))
    process.stdin.emit('end')
    await flush()
    expect(mocks.mockRunHeal).toHaveBeenCalledWith({ selector: '#viejo' })
    expect(log).toHaveBeenCalledWith(JSON.stringify({ fixedSelector: '#nuevo' }))
  })

  it('--stats imprime el resumen a stderr además del output', async () => {
    mocks.mockRunHeal.mockReturnValue({ ok: true, output: { fixedSelector: '#nuevo' } })
    mocks.mockReadHealStats.mockReturnValue({ totalAnalyzed: 5, healed: 3 })
    mocks.mockFormatStats.mockReturnValue('✅ 3 selectores sanados')
    runCli(['heal', '--stats'])
    process.stdin.emit('data', Buffer.from('{"selector":"#viejo"}'))
    process.stdin.emit('end')
    await flush()
    expect(log).toHaveBeenCalledWith(JSON.stringify({ fixedSelector: '#nuevo' }))
    expect(error).toHaveBeenCalledWith('✅ 3 selectores sanados')
  })

  it('stdin vacío (JSON inválido) sale con 1 con error claro', async () => {
    swallowUnhandled()
    runCli(['heal'])
    process.stdin.emit('data', Buffer.from(''))
    process.stdin.emit('end')
    await flush()
    const payload = JSON.parse(log.mock.calls[0][0] as string)
    expect(payload.error).toContain('no es JSON válido')
  })

  it('runHeal que falla devuelve error y sale con 1', async () => {
    swallowUnhandled()
    mocks.mockRunHeal.mockReturnValue({ ok: false, error: 'selector inválido' })
    runCli(['heal'])
    process.stdin.emit('data', Buffer.from('{"selector":""}'))
    process.stdin.emit('end')
    await flush()
    const payload = JSON.parse(log.mock.calls[0][0] as string)
    expect(payload.error).toBe('selector inválido')
  })

  it('error de stdin devuelve error JSON y sale con 1', async () => {
    swallowUnhandled()
    runCli(['heal'])
    process.stdin.emit('error', new Error('stdin roto'))
    await flush()
    const payload = JSON.parse(log.mock.calls[0][0] as string)
    expect(payload.error).toContain('stdin roto')
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('probe-script', () => {
  it('imprime el script de sondeo', () => {
    runCli(['probe-script'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('function'))
  })
})

describe('ai', () => {
  it.each([
    ['setup', 'mockRunAiSetup'],
    ['status', 'mockRunAiStatus'],
    ['models', 'mockRunAiModels'],
  ])('ai %s delega al comando', (sub, mockName) => {
    runCli(['ai', sub])
    expect(mocks[mockName as keyof typeof mocks]).toHaveBeenCalled()
  })

  it('ai explain pasa los argumentos', () => {
    runCli(['ai', 'explain', '#boton'])
    expect(mocks.mockRunAiExplain).toHaveBeenCalledWith(['#boton'])
  })

  it('ai chat delega al chat', () => {
    runCli(['ai', 'chat'])
    expect(mocks.mockRunAiChat).toHaveBeenCalled()
  })

  it('ai con subcomando desconocido: uso + exit 1', () => {
    expect(() => runCli(['ai', 'bogus'])).toThrow('PROCESS_EXIT:1')
    expect(log).toHaveBeenCalledWith('Uso: healify ai <setup|status|explain|chat|models>')
  })

  it('ai sin subcomando: uso + exit 1', () => {
    expect(() => runCli(['ai'])).toThrow('PROCESS_EXIT:1')
    expect(log).toHaveBeenCalledWith('Uso: healify ai <setup|status|explain|chat|models>')
  })
})

describe('confirm', () => {
  it('delega a runConfirm con los args y pasa los id con ok', () => {
    mocks.mockRunConfirm.mockReturnValue({ ok: true, updated: 2, id: 'HLF-X', accepted: true, lines: ['✅ 2 fixes marcados como aceptado (HLF-X).'] })
    runCli(['confirm', '--id', 'HLF-X'])
    expect(mocks.mockRunConfirm).toHaveBeenCalledWith(['--id', 'HLF-X'])
    expect(log).toHaveBeenCalledWith('✅ 2 fixes marcados como aceptado (HLF-X).')
  })

  it('ok false: imprime el error y sale con 1', () => {
    mocks.mockRunConfirm.mockReturnValue({ ok: false, updated: 0, id: 'HLF-X', accepted: true, lines: ['No encontré ningún selector con id HLF-X en el historial.'] })
    expect(() => runCli(['confirm', '--id', 'HLF-X'])).toThrow('PROCESS_EXIT:1')
    expect(log).toHaveBeenCalledWith('No encontré ningún selector con id HLF-X en el historial.')
  })
})

describe('comando desconocido', () => {
  it('imprime ayuda y sale con 1', () => {
    expect(() => runCli(['bogus'])).toThrow('PROCESS_EXIT:1')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Uso: healify <comando>'))
  })

  it('sin argumentos: imprime ayuda y no sale', () => {
    expect(() => runCli([])).not.toThrow()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Uso: healify <comando>'))
  })
})
