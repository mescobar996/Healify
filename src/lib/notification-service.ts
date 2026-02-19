import { db } from '@/lib/db'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export class NotificationService {
    async sendInApp(userId: string, type: NotificationType, title: string, message: string, link?: string) {
        return await db.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                link,
            }
        })
    }

    async sendEmail(email: string, subject: string, body: string) {
        // Simulated Resend/SendGrid integration
        console.log(`[EMAIL] Sending to ${email}: ${subject}`)
        return { success: true }
    }

    async sendSlack(webhookUrl: string, message: string) {
        // Simulated Slack Webhook integration
        console.log(`[SLACK] Sending message: ${message}`)
        return { success: true }
    }

    async notifyTestFailure(projectId: string, testName: string, error: string) {
        const project = await db.project.findUnique({
            where: { id: projectId },
            include: { user: true }
        })

        if (!project || !project.userId) return

        const title = `❌ Test Failed: ${testName}`
        const message = `Test "${testName}" failed in project "${project.name}". Error: ${error.slice(0, 100)}...`

        await this.sendInApp(project.userId, 'error', title, message, `/test-runs`)

        if (project.user?.email) {
            await this.sendEmail(project.user.email, title, message)
        }
    }

    async notifyTestHealed(projectId: string, testName: string, newSelector: string) {
        const project = await db.project.findUnique({
            where: { id: projectId },
            include: { user: true }
        })

        if (!project || !project.userId) return

        const title = `✨ Test Healed: ${testName}`
        const message = `AI successfully auto-healed test "${testName}". New robust selector: ${newSelector}`

        await this.sendInApp(project.userId, 'success', title, message, `/healing-events`)

        if (project.user?.email) {
            await this.sendEmail(project.user.email, title, message)
        }
    }
}

export const notificationService = new NotificationService()
