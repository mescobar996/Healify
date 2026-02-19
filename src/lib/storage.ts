import fs from 'fs/promises'
import path from 'path'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const isProd = process.env.NODE_ENV === 'production'
const storagePath = path.join(process.cwd(), 'storage', 'snapshots')

// S3 Client Configuration (Optional)
const s3Client = process.env.AWS_S3_BUCKET
    ? new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    })
    : null

export async function saveSnapshot(name: string, content: string): Promise<string> {
    if (s3Client && process.env.AWS_S3_BUCKET) {
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: `snapshots/${name}`,
            Body: content,
            ContentType: 'text/html',
        })
        await s3Client.send(command)
        return `s3://${process.env.AWS_S3_BUCKET}/snapshots/${name}`
    } else {
        // Local Storage Mock
        await fs.mkdir(storagePath, { recursive: true })
        const filePath = path.join(storagePath, name)
        await fs.writeFile(filePath, content)
        return `local://${name}`
    }
}

export async function getSnapshotUrl(snapshotPath: string): Promise<string | null> {
    if (snapshotPath.startsWith('s3://') && s3Client) {
        const key = snapshotPath.replace(`s3://${process.env.AWS_S3_BUCKET}/`, '')
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: key,
        })
        return await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    }

    if (snapshotPath.startsWith('local://')) {
        const filename = snapshotPath.replace('local://', '')
        // En desarrollo local devolvemos una ruta relativa o una URL de API que lea el archivo
        return `/api/storage/snapshots/${filename}`
    }

    return null
}
