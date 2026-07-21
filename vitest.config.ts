import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Mock @prisma/client globalmente para que no requiera `prisma generate` en el entorno de test
    // Los tests individuales sobreescriben este mock con vi.mock('@/lib/db', ...) cuando necesitan
    // comportamiento específico. Esta configuración resuelve el error:
    // "PrismaClient did not initialize yet. Please run prisma generate"
    server: {
      deps: {
        inline: ['@prisma/client'],
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/__tests__/**',
        'src/lib/db.ts',        // thin Prisma wrapper
        'src/lib/redis.ts',     // only runtime I/O
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
