'use client'

import React, { useEffect, useMemo } from 'react'
import { motion, useSpring, useMotionValue } from 'framer-motion'

// ============================================
// FLOATING STARS - 40 GLOWING PARTICLES
// ============================================

interface Star {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
  color: 'cyan' | 'purple' | 'white'
}

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 4 + 2,
    delay: Math.random() * 5,
    color: ['cyan', 'purple', 'white'][Math.floor(Math.random() * 3)] as Star['color'],
  }))
}

// ============================================
// CURSOR GLOW - 600px RADIAL BLUR
// ============================================

function CursorGlow() {
  const cursorX = useMotionValue(-600)
  const cursorY = useMotionValue(-600)
  
  // Smooth spring animation
  const springConfig = { damping: 35, stiffness: 120, mass: 1 }
  const cursorXSpring = useSpring(cursorX, springConfig)
  const cursorYSpring = useSpring(cursorY, springConfig)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
    }

    const handleMouseLeave = () => {
      cursorX.set(-600)
      cursorY.set(-600)
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [cursorX, cursorY])

  return (
    <motion.div
      className="cursor-glow hidden lg:block"
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
        transform: 'translate(-50%, -50%)',
      }}
    />
  )
}

// ============================================
// SPACE BACKGROUND COMPONENT
// ============================================

export function BackgroundSpace() {
  const stars = useMemo(() => generateStars(40), [])

  const getStarColor = (color: Star['color']) => {
    const colors = {
      cyan: '#00F5C8',
      purple: '#7B5EF8',
      white: '#E8F0FF',
    }
    return colors[color]
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Deep Space Gradient - Already applied via body CSS */}
      
      {/* Floating Orbs - OBLIGATORIO: 3-5 esferas semitransparentes animadas */}
      <motion.div
        className="absolute top-[10%] left-[15%] w-96 h-96 rounded-full animate-float-y"
        style={{
          background: 'radial-gradient(circle, rgba(0, 245, 200, 0.15) 0%, rgba(0, 245, 200, 0.05) 50%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <motion.div
        className="absolute bottom-[15%] right-[20%] w-[500px] h-[500px] rounded-full animate-float-y-delay-1"
        style={{
          background: 'radial-gradient(circle, rgba(123, 94, 248, 0.12) 0%, rgba(123, 94, 248, 0.04) 50%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />
      <motion.div
        className="absolute top-[50%] left-[60%] w-[400px] h-[400px] rounded-full animate-float-y-delay-2"
        style={{
          background: 'radial-gradient(circle, rgba(255, 107, 255, 0.1) 0%, rgba(255, 107, 255, 0.03) 50%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />
      <motion.div
        className="absolute top-[30%] right-[5%] w-[350px] h-[350px] rounded-full animate-float-y-delay-3"
        style={{
          background: 'radial-gradient(circle, rgba(0, 245, 200, 0.08) 0%, rgba(123, 94, 248, 0.03) 50%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />
      <motion.div
        className="absolute bottom-[5%] left-[40%] w-[450px] h-[450px] rounded-full animate-float-y-delay-4"
        style={{
          background: 'radial-gradient(circle, rgba(123, 94, 248, 0.1) 0%, rgba(255, 107, 255, 0.04) 50%, transparent 70%)',
          filter: 'blur(85px)',
        }}
      />

      {/* 40 Glowing Stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="space-particle"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            background: getStarColor(star.color),
            boxShadow: `0 0 ${star.size * 4}px ${getStarColor(star.color)}`,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}

      {/* Cursor Glow - 600px */}
      <CursorGlow />
    </div>
  )
}

export default BackgroundSpace