import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const notifications = await db.notification.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' },
            take: 20
        })

        return NextResponse.json(notifications)
    } catch (error) {
        console.error('Error fetching notifications:', error)
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        )
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id, read } = await request.json()

        const notification = await db.notification.update({
            where: { id, userId: session.user.id },
            data: { read }
        })

        return NextResponse.json(notification)
    } catch (error) {
        console.error('Error updating notification:', error)
        return NextResponse.json(
            { error: 'Failed to update notification' },
            { status: 500 }
        )
    }
}
