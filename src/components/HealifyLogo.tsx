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
      {/* Logo — nuevo ícono H+ con bug/code */}
      <div className="relative shrink-0 group">
        <Image
          src="/healify-logo.png"
          alt="Healify"
          width={icon}
          height={icon}
          className="object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.15)] group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.25)] transition-all duration-300"
          priority
        />
      </div>

      {/* Texto monocromático */}
      {showText && (
        <span
          className={cn('font-bold tracking-tight select-none text-[#EDEDED]', text)}
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
          background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)',
          borderRadius: '16px',
        }}
      />
      <HealifyLogo size="lg" />
    </div>
  )
}

export default HealifyLogo
