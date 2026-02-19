import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string } }
) {
    try {
        const filename = params.filename
        const filePath = path.join(process.cwd(), 'storage', 'snapshots', filename)

        const fileBuffer = await fs.readFile(filePath)

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'text/html',
            },
        })
    } catch (error) {
        console.error('Storage API Error:', error)
        return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }
}
