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
const IV_LENGTH = 12          // 96-bit nonce for GCM (NIST recommended)
const AUTH_TAG_LENGTH = 16    // 128-bit authentication tag

/**
 * Encrypt using AES-256-GCM (authenticated encryption).
 * Output format: `iv_hex:authTag_hex:ciphertext_hex`
 */
export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    })
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    const authTag = cipher.getAuthTag()
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex')
}

/**
 * Decrypt using AES-256-GCM. Validates the authentication tag to
 * protect against padding-oracle and tamper attacks.
 */
export function decrypt(text: string): string {
    const parts = text.split(':')
    if (parts.length < 3) {
        throw new Error('Invalid ciphertext format: expected iv:authTag:ciphertext')
    }
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encryptedText = Buffer.from(parts.slice(2).join(':'), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', DERIVED_KEY, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}
// generateApiKey and rotateApiKey in '@/lib/api-key-service'

