import { Redis } from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Borrado para BullMQ compatibility
})

redis.on('error', (err) => console.error('Redis Client Error', err))
redis.on('connect', () => console.log('Redis connected'))
