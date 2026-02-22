'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface HealifyLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

const sizes = {
  sm: { width: 24, height: 24, text: 'text-base' },
  md: { width: 32, height: 32, text: 'text-lg' },
  lg: { width: 44, height: 44, text: 'text-xl' },
}

export function HealifyLogo({ 
  className, 
  size = 'md', 
  showText = true 
}: HealifyLogoProps) {
  const { width, height, text } = sizes[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo SVG - V + </> Technical Monogram */}
      <div className="relative group">
        <svg
          width={width}
          height={height}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 logo-glow"
        >
          <defs>
            {/* Gradiente Exacto: Cyan → Violeta → Pink */}
            <linearGradient id="healifyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5C8" /> {/* Cyan Neon */}
              <stop offset="50%" stopColor="#7B5EF8" /> {/* Violeta/Purple Neon */}
              <stop offset="100%" stopColor="#FF6BFF" /> {/* Pink Neon */}
            </linearGradient>
            {/* Glow filter para efecto neón */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* V Shape - Left side (banda superior izquierda) */}
          <path
            d="M8 12 L20 12 L24 36 L16 36 Z"
            fill="url(#healifyGradient)"
            filter="url(#glow)"
            opacity="0.9"
          />
          
          {/* V Shape - Right side (banda superior derecha) */}
          <path
            d="M28 12 L40 12 L32 36 L24 36 Z"
            fill="url(#healifyGradient)"
            filter="url(#glow)"
            opacity="0.9"
          />
          
          {/* Símbolo </> - Left bracket < */}
          <path
            d="M14 20 L10 24 L14 28"
            stroke="url(#healifyGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#glow)"
          />
          
          {/* Símbolo </> - Forward slash / */}
          <path
            d="M18 18 L22 30"
            stroke="url(#healifyGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          
          {/* Símbolo </> - Right bracket > */}
          <path
            d="M34 20 L38 24 L34 28"
            stroke="url(#healifyGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#glow)"
          />
        </svg>
        
        {/* Hover glow effect */}
        <div 
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 245, 200, 0.3), rgba(123, 94, 248, 0.3), rgba(255, 107, 255, 0.2))',
          }}
        />
      </div>

      {/* Text - Gradient */}
      {showText && (
        <span 
          className={cn(
            'font-bold tracking-tight',
            text
          )}
          style={{
            background: 'linear-gradient(135deg, #00F5C8 0%, #7B5EF8 50%, #FF6BFF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Healify
        </span>
      )}
    </div>
  )
}

// Animated version for loading states
export function HealifyLogoAnimated({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div 
        className="absolute inset-0 blur-2xl animate-pulse"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 245, 200, 0.2), rgba(123, 94, 248, 0.2), rgba(255, 107, 255, 0.15))',
          borderRadius: '16px',
        }}
      />
      <HealifyLogo size="lg" />
    </div>
  )
}

export default HealifyLogo