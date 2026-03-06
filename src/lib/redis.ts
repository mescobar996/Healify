import { Redis } from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// IMPORTANTE: Detectar verdaderamente el build time.
// NO usar VERCEL='1' ya que también se inyecta en runtime en Vercel.
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

// Lazy initialization: solo crear conexión cuando se necesite, no durante build time
let redisInstance: Redis | null = null

function createRedisInstance(): Redis | null {
  // Durante build time en Vercel, no crear instancia (Railway no es accesible)
  if (isBuildTime) {
    console.log('[Redis] Skipping connection during build time')
    return null
  }

  // Si no hay URL válida de Redis, no crear instancia
  if (!redisUrl || redisUrl === 'redis://localhost:6379') {
    return null
  }

  try {
    const instance = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
      // Exponential backoff: 50ms → 100ms → 200ms … cap at 5 s, give up after ~2 min
      retryStrategy(times: number) {
        if (times > 20) return null            // stop retrying
        return Math.min(times * 50, 5_000)     // exponential with 5 s cap
      },
      reconnectOnError(err: Error) {
        // Reconnect on READONLY errors (e.g. failover)
        return err.message.includes('READONLY')
      },
    })

    instance.on('error', (err) => {
      if (!isBuildTime) {
        console.error('Redis Client Error', err)
      }
    })

    instance.on('connect', () => {
      if (!isBuildTime) {
        console.info('Redis connected')
      }
    })

    instance.on('reconnecting', (delay: number) => {
      console.info(`Redis reconnecting in ${delay}ms…`)
    })

    return instance
  } catch (error) {
    // Silenciar errores durante build
    if (!isBuildTime) {
      console.warn('Redis initialization failed:', error)
    }
    return null
  }
}

// Función helper para obtener instancia de Redis (lazy)
function getRedis(): Redis | null {
  // Durante build time en Vercel, retornar null directamente
  if (isBuildTime) {
    return null
  }

  if (!redisInstance) {
    redisInstance = createRedisInstance()
  }

  return redisInstance
}

// Exportar wrapper que maneja Redis de forma segura para uso directo
export const redis = {
  get: async (key: string): Promise<string | null> => {
    const instance = getRedis()
    if (!instance) return null
    try {
      return await instance.get(key)
    } catch (err) {
      console.warn('[Redis] get failed:', (err as Error).message)
      return null
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    const instance = getRedis()
    if (!instance) return
    try {
      await instance.set(key, value)
    } catch (err) {
      console.warn('[Redis] set failed:', (err as Error).message)
    }
  },
  setex: async (key: string, seconds: number, value: string): Promise<void> => {
    const instance = getRedis()
    if (!instance) return
    try {
      await instance.setex(key, seconds, value)
    } catch (err) {
      console.warn('[Redis] setex failed:', (err as Error).message)
    }
  },
  del: async (key: string): Promise<void> => {
    const instance = getRedis()
    if (!instance) return
    try {
      await instance.del(key)
    } catch (err) {
      console.warn('[Redis] del failed:', (err as Error).message)
    }
  },
  exists: async (key: string): Promise<number> => {
    const instance = getRedis()
    if (!instance) return 0
    try {
      return await instance.exists(key)
    } catch (err) {
      console.warn('[Redis] exists failed:', (err as Error).message)
      return 0
    }
  },
  incr: async (key: string): Promise<number> => {
    const instance = getRedis()
    if (!instance) return 0
    try {
      return await instance.incr(key)
    } catch (err) {
      console.warn('[Redis] incr failed:', (err as Error).message)
      return 0
    }
  },
  expire: async (key: string, seconds: number): Promise<void> => {
    const instance = getRedis()
    if (!instance) return
    try {
      await instance.expire(key, seconds)
    } catch (err) {
      console.warn('[Redis] expire failed:', (err as Error).message)
    }
  },
  ttl: async (key: string): Promise<number> => {
    const instance = getRedis()
    if (!instance) return -2
    try {
      return await instance.ttl(key)
    } catch (err) {
      console.warn('[Redis] ttl failed:', (err as Error).message)
      return -2
    }
  },
} as unknown as Redis

// Exportar función para obtener la instancia real de Redis (para BullMQ y otros casos especiales)
export function getRedisInstance(): Redis | null {
  return getRedis()
}
