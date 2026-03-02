import crypto from 'crypto'

const ENCRYPTION_KEY = (() => {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(
                '[SECURITY] ENCRYPTION_KEY no configurada. ' +
                'Ejecutá: openssl rand -hex 32 ' +
                'y agregá el resultado como variable de entorno ENCRYPTION_KEY en Vercel.'
            )
        }
        console.warn(
            '[SECURITY WARNING] ENCRYPTION_KEY no configurada. ' +
            'Generá una con: openssl rand -hex 32 ' +
            'y agregala a tu .env.local'
        )
        return 'dev-only-not-for-production-use-set-encryption-key-env'
    }
    if (key.length < 32) {
        throw new Error('[SECURITY] ENCRYPTION_KEY debe tener al menos 32 caracteres.')
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
// generateApiKey and rotateApiKey moved to '@/lib/api-key-service'
