import { db } from '@/lib/db'

export type AuditAction =
    | 'PROJECT_CREATE'
    | 'PROJECT_DELETE'
    | 'TEST_RUN_START'
    | 'SUBSCRIPTION_CHANGE'
    | 'API_KEY_ROTATE'
    | 'SETTING_UPDATE'

export class AuditLogService {
    async log(userId: string, action: AuditAction, resourceId: string, metadata: any = {}) {
        console.log(`[AUDIT] User ${userId} performed ${action} on ${resourceId}`)

        // In a real app, this would be a high-performance write to a separate table
        // or an external logging service like Datadog/ELK
        return await db.analyticsEvent.create({
            data: {
                eventType: 'audit_log',
                projectId: resourceId.startsWith('proj_') ? resourceId : null,
                metadata: JSON.stringify({
                    userId,
                    action,
                    resourceId,
                    ...metadata,
                    timestamp: new Date().toISOString(),
                })
            }
        })
    }

    async getLogs(resourceId?: string) {
        return await db.analyticsEvent.findMany({
            where: {
                eventType: 'audit_log',
                ...(resourceId ? { projectId: resourceId } : {})
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        })
    }
}

export const auditLogService = new AuditLogService()
