import { Redis } from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// Detectar si estamos en build time (Next.js genera páginas estáticas)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                    (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV && !process.env.REDIS_URL)

// Lazy initialization: solo crear conexión cuando se necesite, no durante build time
let redisInstance: Redis | null = null

function createRedisInstance(): Redis | null {
  // Durante build time, no crear instancia
  if (isBuildTime) {
    return null
  }

  // Si no hay URL válida de Redis, no crear instancia
  if (!redisUrl || redisUrl === 'redis://localhost:6379') {
    return null
  }

  try {
    const instance = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true, // No conectar inmediatamente
      retryStrategy: () => null, // No reintentar automáticamente
      enableOfflineQueue: false, // No hacer queue si está offline
    })

    instance.on('error', (err) => {
      // Solo loggear errores en runtime, no en build
      if (!isBuildTime) {
        console.error('Redis Client Error', err)
      }
    })

    instance.on('connect', () => {
      if (!isBuildTime) {
        console.log('Redis connected')
      }
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
    } catch {
      return null
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    const instance = getRedis()
    if (!instance) return
    try {
      await instance.set(key, value)
    } catch {
      // Silenciar errores
    }
  },
  setex: async (key: string, seconds: number, value: string): Promise<void> => {
    const instance = getRedis()
    if (!instance) return
    try {
      await instance.setex(key, seconds, value)
    } catch {
      // Silenciar errores
    }
  },
  del: async (key: string): Promise<void> => {
    const instance = getRedis()
    if (!instance) return
    try {
      await instance.del(key)
    } catch {
      // Silenciar errores
    }
  },
  exists: async (key: string): Promise<number> => {
    const instance = getRedis()
    if (!instance) return 0
    try {
      return await instance.exists(key)
    } catch {
      return 0
    }
  },
} as unknown as Redis

// Exportar función para obtener la instancia real de Redis (para BullMQ y otros casos especiales)
export function getRedisInstance(): Redis | null {
  return getRedis()
}
