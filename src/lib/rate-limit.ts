export class RateLimiter {
    private requests: Map<string, number[]> = new Map()

    check(id: string, limit: number, windowMs: number): boolean {
        const now = Date.now()
        const windowStart = now - windowMs

        let userRequests = this.requests.get(id) || []

        // Filter requests within the window
        userRequests = userRequests.filter(timestamp => timestamp > windowStart)

        if (userRequests.length >= limit) {
            return false
        }

        userRequests.push(now)
        this.requests.set(id, userRequests)
        return true
    }

    // Helper for common limits
    isRateLimited(id: string): boolean {
        // 60 requests per minute by default
        return !this.check(id, 60, 60000)
    }
}

export const rateLimiter = new RateLimiter()
