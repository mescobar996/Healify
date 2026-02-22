import Link from 'next/link'
import { HealifyLogo } from '@/components/HealifyLogo'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(123,94,248,0.12) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0,245,200,0.1) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Card */}
      <div className="glass-elite glass-elite-large p-12 text-center max-w-md w-full relative z-10">
        <div className="flex justify-center mb-8">
          <HealifyLogo size="lg" showText={true} />
        </div>

        {/* 404 Number */}
        <div
          className="text-8xl font-bold mb-4 font-heading"
          style={{
            background: 'linear-gradient(135deg, #00F5C8, #7B5EF8, #FF6BFF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          404
        </div>

        <h1 className="text-xl font-semibold text-[#E8F0FF] mb-3 font-heading">
          Selector Not Found
        </h1>
        <p className="text-sm text-[#E8F0FF]/60 mb-8 leading-relaxed">
          Esta ruta no existe. Incluso nuestra IA no pudo encontrarla.
          <br />
          Confianza: <span className="text-[#00F5C8] font-mono">0%</span>
        </p>

        {/* Code-style error */}
        <div className="rounded-xl bg-black/30 border border-white/5 p-4 mb-8 text-left">
          <code className="text-xs font-mono text-[#E8F0FF]/50">
            <span className="text-red-400">ElementNotFound:</span>{' '}
            <span className="text-[#00F5C8]">cannot locate</span>{' '}
            <span className="text-amber-300">&apos;{typeof window !== 'undefined' ? window.location.pathname : '/this-page'}&apos;</span>
            <br />
            <span className="text-[#E8F0FF]/30">{'  '}→ Suggested fix: navigate home</span>
          </code>
        </div>

        <Link
          href="/"
          className="btn-neon inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[#0A0E1A] no-underline"
          style={{
            background: 'linear-gradient(135deg, #00F5C8, #7B5EF8)',
            boxShadow: '0 0 20px rgba(0,245,200,0.4)',
          }}
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}
