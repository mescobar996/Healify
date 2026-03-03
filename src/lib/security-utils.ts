import crypto from 'crypto'

// Derive exactly 32 bytes from any passphrase via SHA-256.
// This is safe for any key length and is backward-compatible with the
// documented usage of `openssl rand -hex 32` (64-char hex strings).
function deriveKey(passphrase: string): Buffer {
    return crypto.createHash('sha256').update(passphrase).digest()
}

const ENCRYPTION_KEY_RAW = (() => {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(
                '[SECURITY] ENCRYPTION_KEY no configurada. ' +
                'Ejecuta: openssl rand -hex 32 ' +
                'y agrega el resultado como variable de entorno ENCRYPTION_KEY.'
            )
        }
        console.warn(
            '[SECURITY WARNING] ENCRYPTION_KEY no configurada. ' +
            'Genera una con: openssl rand -hex 32 y agrega a tu .env.local'
        )
        return 'dev-only-insecure-key-replace-in-production'
    }
    if (key.length < 16) {
        throw new Error('[SECURITY] ENCRYPTION_KEY debe tener al menos 16 caracteres.')
    }
    return key
})()

// Always 32 bytes, regardless of passphrase length
const DERIVED_KEY = deriveKey(ENCRYPTION_KEY_RAW)
const IV_LENGTH = 16

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-cbc', DERIVED_KEY, iv)
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(text: string): string {
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift()!, 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', DERIVED_KEY, iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}
// generateApiKey and rotateApiKey in '@/lib/api-key-service'

