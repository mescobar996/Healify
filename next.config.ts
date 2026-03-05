import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // ✅ HEAL-003 FIX: No ignorar errores — TypeScript debe validar en build
    ignoreBuildErrors: false,
  },
  // ✅ HEAL-003 FIX: StrictMode detecta bugs antes de producción
  reactStrictMode: true,

  // ============================================
  // IMAGE REMOTE PATTERNS
  // ============================================
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'playwright.dev' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.githubassets.com' },
    ],
  },

  // ============================================
  // SECURITY HEADERS
  // ============================================
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://api.stripe.com https://sentry.io https://*.sentry.io",
              "frame-src https://js.stripe.com https://www.loom.com",
              "font-src 'self'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
      // API routes: no cache, no store
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex",
          },
        ],
      },
    ];
  },

  // ============================================
  // REDIRECTS
  // ============================================
  async redirects() {
    return [
      // Redirect authenticated users away from landing
      // Handled client-side via useSession
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry project info — set SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN in CI/CD
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Automatically instrument Node.js runtime without extra code
  autoInstrumentServerFunctions: true,

  // Upload source maps to Sentry on every build (requires SENTRY_AUTH_TOKEN)
  widenClientFileUpload: true,

  // Disable automatic prefetch instrumentation (reduces bundle size impact)
  disableLogger: true,

  // Source maps: delete local files after upload so they don't ship to users
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
})
