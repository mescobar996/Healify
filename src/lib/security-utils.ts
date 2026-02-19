import crypto from 'crypto'
import { db } from '@/lib/db'
import { auditLogService } from './audit-log-service'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'v-7y$B&E)H@McQfTjWnZr4u7x!A%C*F-' // 32 chars
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
