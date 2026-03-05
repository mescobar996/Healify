import crypto from 'crypto'
import { db } from '@/lib/db'
import { auditLogService } from './audit-log-service'

const ENCRYPTION_KEY = (() => {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[SECURITY] ENCRYPTION_KEY no configurada en producción. ' +
        'Generá una con: openssl rand -hex 32 ' +
        'y agregala como variable ENCRYPTION_KEY en Vercel.'
      )
    }
    // Solo desarrollo local — NUNCA en producción
    console.warn('[SECURITY] ENCRYPTION_KEY no configurada — clave dev temporal activa.')
    return 'dev-only-32-char-key-not-for-prod!!'
  }
  if (Buffer.byteLength(key, 'utf8') < 32) {
    throw new Error('[SECURITY] ENCRYPTION_KEY debe tener al menos 32 bytes.')
  }
  return key
})()
const IV_LENGTH = 16

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(text: string): string {
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift()!, 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}

export function generateApiKey(): string {
    return `hf_${crypto.randomBytes(24).toString('hex')}`
}

export async function rotateApiKey(projectId: string, userId: string): Promise<string> {
    const newKey = generateApiKey()

    await db.project.update({
        where: { id: projectId },
        data: { apiKey: newKey }
    })

    await auditLogService.log(userId, 'API_KEY_ROTATE', projectId, {
        timestamp: new Date().toISOString()
    })

    return newKey
}
