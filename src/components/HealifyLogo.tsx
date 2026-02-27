'use client'

import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface HealifyLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

const sizes = {
  sm: { icon: 24, text: 'text-base' },
  md: { icon: 32, text: 'text-lg' },
  lg: { icon: 44, text: 'text-xl' },
}

export function HealifyLogo({ 
  className, 
  size = 'md', 
  showText = true 
}: HealifyLogoProps) {
  const { icon, text } = sizes[size]

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* Logo real — PNG con el ícono V+</> */}
      <div className="relative shrink-0 group">
        <Image
          src="/icon.png"
          alt="Healify"
          width={icon}
          height={icon}
          className="object-contain drop-shadow-[0_0_8px_rgba(0,245,200,0.4)] group-hover:drop-shadow-[0_0_14px_rgba(123,94,248,0.6)] transition-all duration-300"
          priority
        />
      </div>

      {/* Texto con gradiente cyan → violeta → lila */}
      {showText && (
        <span
          className={cn('font-bold tracking-tight select-none', text)}
          style={{
            background: 'linear-gradient(135deg, #00F5C8 0%, #7B5EF8 60%, #C084FC 100%)',
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

// Versión animada para loading states
export function HealifyLogoAnimated({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div
        className="absolute inset-0 blur-2xl animate-pulse"
        style={{
          background: 'linear-gradient(135deg, rgba(0,245,200,0.2), rgba(123,94,248,0.2), rgba(192,132,252,0.15))',
          borderRadius: '16px',
        }}
      />
      <HealifyLogo size="lg" />
    </div>
  )
}

export default HealifyLogo
