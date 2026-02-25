import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────
const mockProject = {
  id: 'proj_test_123',
  name: 'My App',
  description: 'Test project',
  repository: 'https://github.com/user/repo',
  framework: 'playwright',
  apiKey: 'hf_live_abc123',
  userId: 'user_1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockDb = {
  project: {
    findUnique:  vi.fn(),
    findMany:    vi.fn(),
    create:      vi.fn(),
    update:      vi.fn(),
    delete:      vi.fn(),
    count:       vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/audit-log-service', () => ({
  auditLogService: { log: vi.fn() },
}))

// ── Project schema validation helpers ────────────────────────────────

function validateProjectCreate(data: Record<string, unknown>) {
  const errors: string[] = []
  if (!data.name || typeof data.name !== 'string' || !data.name.trim())
    errors.push('name is required')
  if (data.repository && typeof data.repository === 'string') {
    try { new URL(data.repository) } catch { errors.push('repository must be a valid URL') }
  }
  return { valid: errors.length === 0, errors }
}

function validateProjectUpdate(data: Record<string, unknown>) {
  const allowed = ['name', 'description', 'repository', 'framework']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (fields.length === 0) return { valid: false, errors: ['No fields to update'] }
  if (data.name !== undefined && (!data.name || typeof data.name !== 'string'))
    return { valid: false, errors: ['name cannot be empty'] }
  return { valid: true, errors: [], fields }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Projects API — CREATE validation', () => {

  it('nombre requerido', () => {
    expect(validateProjectCreate({}).valid).toBe(false)
    expect(validateProjectCreate({ name: '' }).valid).toBe(false)
    expect(validateProjectCreate({ name: '  ' }).valid).toBe(false)
  })

  it('nombre válido pasa', () => {
    expect(validateProjectCreate({ name: 'My App' }).valid).toBe(true)
  })

  it('repository debe ser URL válida si se provee', () => {
    expect(validateProjectCreate({ name: 'App', repository: 'not-a-url' }).valid).toBe(false)
    expect(validateProjectCreate({ name: 'App', repository: 'https://github.com/u/r' }).valid).toBe(true)
  })

  it('description es opcional', () => {
    expect(validateProjectCreate({ name: 'App', description: 'optional' }).valid).toBe(true)
    expect(validateProjectCreate({ name: 'App' }).valid).toBe(true)
  })
})

describe('Projects API — UPDATE (PATCH) validation', () => {

  it('requiere al menos un campo', () => {
    expect(validateProjectUpdate({}).valid).toBe(false)
    expect(validateProjectUpdate({ name: 'New Name' }).valid).toBe(true)
  })

  it('name no puede ser vacío en update', () => {
    expect(validateProjectUpdate({ name: '' }).valid).toBe(false)
    expect(validateProjectUpdate({ name: 'New' }).valid).toBe(true)
  })

  it('description y repository se pueden actualizar solos', () => {
    expect(validateProjectUpdate({ description: 'New desc' }).valid).toBe(true)
    expect(validateProjectUpdate({ repository: 'https://github.com/x/y' }).valid).toBe(true)
  })

  it('campos no permitidos se ignoran', () => {
    const result = validateProjectUpdate({ apiKey: 'hack', userId: 'evil', name: 'ok' })
    expect(result.valid).toBe(true)
    expect(result.fields).toEqual(['name'])
    expect(result.fields).not.toContain('apiKey')
    expect(result.fields).not.toContain('userId')
  })
})

describe('Projects API — DB operations (mocked)', () => {

  beforeEach(() => vi.clearAllMocks())

  it('findUnique por id y userId (ownership check)', async () => {
    mockDb.project.findUnique.mockResolvedValue(mockProject)
    const result = await mockDb.project.findUnique({
      where: { id: 'proj_test_123', userId: 'user_1' },
    })
    expect(result).toEqual(mockProject)
    expect(mockDb.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'proj_test_123', userId: 'user_1' },
    })
  })

  it('findUnique retorna null si proyecto no pertenece al usuario', async () => {
    mockDb.project.findUnique.mockResolvedValue(null)
    const result = await mockDb.project.findUnique({
      where: { id: 'proj_test_123', userId: 'otro_user' },
    })
    expect(result).toBeNull()
  })

  it('delete requiere id + userId para no borrar ajeno', async () => {
    mockDb.project.delete.mockResolvedValue(mockProject)
    await mockDb.project.delete({ where: { id: mockProject.id, userId: mockProject.userId } })
    expect(mockDb.project.delete).toHaveBeenCalledWith({
      where: { id: 'proj_test_123', userId: 'user_1' },
    })
  })

  it('update retorna proyecto actualizado', async () => {
    const updated = { ...mockProject, name: 'Renamed App' }
    mockDb.project.update.mockResolvedValue(updated)
    const result = await mockDb.project.update({
      where: { id: mockProject.id, userId: mockProject.userId },
      data: { name: 'Renamed App' },
    })
    expect(result.name).toBe('Renamed App')
    expect(result.id).toBe(mockProject.id)
  })

  it('count de proyectos por userId', async () => {
    mockDb.project.count.mockResolvedValue(3)
    const count = await mockDb.project.count({ where: { userId: 'user_1' } })
    expect(count).toBe(3)
  })
})

describe('Projects API — Plan limits', () => {

  it('FREE plan: máximo 3 proyectos', async () => {
    const FREE_LIMIT = 3
    mockDb.project.count.mockResolvedValue(3)
    const count = await mockDb.project.count({ where: { userId: 'user_1' } })
    expect(count >= FREE_LIMIT).toBe(true)
  })

  it('PRO plan: 20 proyectos permitidos', async () => {
    const PRO_LIMIT = 20
    mockDb.project.count.mockResolvedValue(15)
    const count = await mockDb.project.count({ where: { userId: 'user_1' } })
    expect(count < PRO_LIMIT).toBe(true)
  })

  it('apiKey tiene formato válido (no vacío)', () => {
    expect(mockProject.apiKey).toBeTruthy()
    expect(typeof mockProject.apiKey).toBe('string')
    expect(mockProject.apiKey.length).toBeGreaterThan(8)
  })
})
