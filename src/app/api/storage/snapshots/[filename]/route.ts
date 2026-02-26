import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import fs from 'fs/promises'
import path from 'path'

// GET /api/storage/snapshots/[filename]
// Sirve snapshots HTML del DOM capturados durante healing.
// Protegido: requiere sesión activa.
// Seguro: valida que el filename no contenga path traversal.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { filename } = await params

        // ── Prevenir path traversal ──────────────────────────────────
        // Solo permitir nombres de archivo seguros: alfanuméricos, guiones, puntos
        const SAFE_FILENAME = /^[a-zA-Z0-9_\-]+\.html$/
        if (!SAFE_FILENAME.test(filename)) {
            return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
        }

        // Construir path seguro y verificar que esté dentro del directorio permitido
        const snapshotsDir = path.join(process.cwd(), 'storage', 'snapshots')
        const filePath     = path.join(snapshotsDir, filename)

        // Double-check que el path resuelto no sale del directorio
        if (!filePath.startsWith(snapshotsDir)) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
        }

        const fileBuffer = await fs.readFile(filePath)

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
                'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline';",
            },
        })
    } catch (error) {
        return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }
}
