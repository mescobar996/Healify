import { Resend } from 'resend'
import { db } from '@/lib/db'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

function getResend(): Resend | null {
    if (!process.env.RESEND_API_KEY) return null
    return new Resend(process.env.RESEND_API_KEY)
}

function buildEmailHtml(title: string, body: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0E1A;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E1A;padding:40px 20px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0D1117;border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">
<tr><td style="padding:24px 32px;background:linear-gradient(135deg,rgba(0,245,200,0.1),rgba(123,94,248,0.1));border-bottom:1px solid rgba(255,255,255,0.06)">
<span style="font-size:22px;font-weight:800;color:#00F5C8">HEALIFY</span>
<span style="font-size:13px;color:rgba(232,240,255,0.4);margin-left:8px">· Tests that heal themselves</span>
</td></tr>
<tr><td style="padding:32px">
<h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#E8F0FF">${title}</h2>
<p style="margin:0;font-size:14px;line-height:1.6;color:rgba(232,240,255,0.6)">${body}</p>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06)">
<p style="margin:0;font-size:11px;color:rgba(232,240,255,0.25)">
Healify ·
<a href="https://healify-sigma.vercel.app/dashboard" style="color:#00F5C8;text-decoration:none">Ver dashboard</a> ·
<a href="https://healify-sigma.vercel.app/dashboard/settings" style="color:rgba(232,240,255,0.25);text-decoration:none">Gestionar notificaciones</a>
</p></td></tr>
</table></td></tr></table></body></html>`
}

function buildSlackPayload(title: string, body: string, type: NotificationType) {
    const emoji = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }[type] || 'ℹ️'
    return {
        blocks: [
            { type: 'header', text: { type: 'plain_text', text: `${emoji} ${title}`, emoji: true } },
            { type: 'section', text: { type: 'mrkdwn', text: body } },
            { type: 'context', elements: [{ type: 'mrkdwn', text: '*Healify* · <https://healify-sigma.vercel.app/dashboard|Ver dashboard>' }] }
        ]
    }
}

async function createJiraIssue(params: {
    summary: string
    description: string
}): Promise<{ success: boolean; url?: string }> {
    const baseUrl = process.env.JIRA_BASE_URL
    const email = process.env.JIRA_EMAIL
    const apiToken = process.env.JIRA_API_TOKEN
    const projectKey = process.env.JIRA_PROJECT_KEY

    if (!baseUrl || !email || !apiToken || !projectKey) {
        return { success: false }
    }

    try {
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64')
        const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                fields: {
                    project: { key: projectKey },
                    summary: params.summary,
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: params.description }],
                            },
                        ],
                    },
                    issuetype: { name: 'Bug' },
                },
            }),
        })

        if (!response.ok) {
            const body = await response.text().catch(() => '')
            console.error('[JIRA] Error creating issue:', response.status, body)
            return { success: false }
        }

        const data = await response.json()
        const issueUrl = `${baseUrl}/browse/${data.key}`
        return { success: true, url: issueUrl }
    } catch (error) {
        console.error('[JIRA] Unexpected error:', error)
        return { success: false }
    }
}

export class NotificationService {

    async sendInApp(userId: string, type: NotificationType, title: string, message: string, link?: string) {
        return await db.notification.create({ data: { userId, type, title, message, link } })
    }

    async sendEmail(to: string, subject: string, body: string) {
        const resend = getResend()
        if (!resend) {
            console.log(`[EMAIL MOCK] To: ${to} | ${subject}`)
            return { success: true, mock: true }
        }
        try {
            const { data, error } = await resend.emails.send({
                from: 'Healify <noreply@healify.dev>',
                to,
                subject,
                html: buildEmailHtml(subject, body),
            })
            if (error) { console.error('[EMAIL] Resend error:', error); return { success: false } }
            console.log(`[EMAIL] Sent to ${to} — id: ${data?.id}`)
            return { success: true, id: data?.id }
        } catch (err) {
            console.error('[EMAIL] Unexpected error:', err)
            return { success: false }
        }
    }

    async sendSlack(webhookUrl: string, message: string, title = 'Healify Notification', type: NotificationType = 'info') {
        if (!webhookUrl) { console.log('[SLACK MOCK] No webhook URL'); return { success: true, mock: true } }
        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildSlackPayload(title, message, type)),
            })
            if (!res.ok) { console.error(`[SLACK] Error ${res.status}`); return { success: false } }
            return { success: true }
        } catch (err) {
            console.error('[SLACK] Error:', err)
            return { success: false }
        }
    }

    async notifyTestFailure(projectId: string, testName: string, error: string) {
        const project = await db.project.findUnique({ where: { id: projectId }, include: { user: true } })
        if (!project?.userId || !project.user) return

        const title   = `Test fallido: ${testName}`
        const message = `El test "${testName}" en "${project.name}" falló sin autocuración. Error: ${error.slice(0, 150)}`

        await this.sendInApp(project.userId, 'error', `❌ ${title}`, message, '/dashboard/tests')
        if (project.user.email)           await this.sendEmail(project.user.email, `❌ ${title}`, message)
        if (project.user.slackWebhookUrl) await this.sendSlack(project.user.slackWebhookUrl, message, title, 'error')
    }

    async notifyTestHealed(projectId: string, testName: string, newSelector: string) {
        const project = await db.project.findUnique({ where: { id: projectId }, include: { user: true } })
        if (!project?.userId || !project.user) return

        const title   = `Test autocurado: ${testName}`
        const message = `Healify autocuró "${testName}" en "${project.name}". Nuevo selector: ${newSelector}`

        await this.sendInApp(project.userId, 'success', `✨ ${title}`, message, '/dashboard/healing')
        if (project.user.email)           await this.sendEmail(project.user.email, `✨ ${title}`, message)
        if (project.user.slackWebhookUrl) await this.sendSlack(project.user.slackWebhookUrl, message, title, 'success')
    }

    async notifyBugDetected(projectId: string, testName: string, error: string, branch?: string | null) {
        const project = await db.project.findUnique({ where: { id: projectId }, include: { user: true } })
        if (!project?.userId || !project.user) return

        const title = `Bug detectado: ${testName}`
        const message = `Healify detectó un bug real en "${project.name}" (${branch || 'sin branch'}). Error: ${error.slice(0, 180)}`

        const jira = await createJiraIssue({
            summary: `[Healify] ${testName} — BUG_DETECTED`,
            description: `${message}\n\nProyecto: ${project.name}\nRepositorio: ${project.repository || 'N/A'}`,
        })

        await this.sendInApp(
            project.userId,
            'warning',
            `🐞 ${title}`,
            jira.success && jira.url ? `${message} | Jira: ${jira.url}` : message,
            jira.success && jira.url ? jira.url : '/dashboard/tests'
        )

        if (project.user.email) {
            await this.sendEmail(
                project.user.email,
                `🐞 ${title}`,
                jira.success && jira.url
                    ? `${message}<br/><br/>Jira: <a href="${jira.url}">${jira.url}</a>`
                    : `${message}<br/><br/>Tip: configurá variables de Jira para crear tickets automáticos.`
            )
        }

        if (project.user.slackWebhookUrl) {
            await this.sendSlack(project.user.slackWebhookUrl, message, title, 'warning')
        }
    }
}

export const notificationService = new NotificationService()
