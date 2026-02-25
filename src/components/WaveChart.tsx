'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface WaveChartProps {
  className?: string
}

export function WaveChart({ className = '' }: WaveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    let time = 0
    const amplitude = 30
    const frequency = 0.02

    const drawWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Grid lines sutiles
      ctx.strokeStyle = '#1F1F26'
      ctx.lineWidth = 1
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(canvas.width, i)
        ctx.stroke()
      }

      // Wave principal — indigo sólido, sin gradiente
      ctx.strokeStyle = '#22C55E'
      ctx.lineWidth = 2
      ctx.beginPath()

      const centerY = canvas.height / 2
      for (let x = 0; x < canvas.width; x += 2) {
        const y = centerY + amplitude * Math.sin((x * frequency) + time)
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()

      // Glow effect
      ctx.shadowBlur = 20
      ctx.shadowColor = 'transparent'
      ctx.stroke()
      ctx.shadowBlur = 0

      // Wave secundaria más pequeña
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)'
      ctx.lineWidth = 2
      ctx.beginPath()

      const centerY2 = canvas.height * 0.75
      for (let x = 0; x < canvas.width; x += 2) {
        const y = centerY2 + (amplitude * 0.5) * Math.sin((x * frequency * 1.5) + time * 1.2)
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()

      time += 0.05

      animationRef.current = requestAnimationFrame(drawWave)
    }

    drawWave()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <div className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: 'crisp-edges' }}
      />
      {/* Label overlay */}
      <div className="absolute top-4 left-4 text-sm font-mono text-[#E8F0FF] opacity-60">
        86.91%
      </div>
    </div>
  )
}
