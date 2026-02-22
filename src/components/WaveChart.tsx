'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface WaveChartProps {
  className?: string
}

export function WaveChart({ className = '' }: WaveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.lineWidth = 1
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(canvas.width, i)
        ctx.stroke()
      }

      // Wave principal con gradiente cyan → purple
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
      gradient.addColorStop(0, '#00F5C8')
      gradient.addColorStop(0.5, '#7B5EF8')
      gradient.addColorStop(1, '#FF6BFF')

      ctx.strokeStyle = gradient
      ctx.lineWidth = 3
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
      ctx.shadowColor = '#00F5C8'
      ctx.stroke()
      ctx.shadowBlur = 0

      // Wave secundaria más pequeña
      const gradient2 = ctx.createLinearGradient(0, 0, canvas.width, 0)
      gradient2.addColorStop(0, 'rgba(0, 245, 200, 0.3)')
      gradient2.addColorStop(1, 'rgba(123, 94, 248, 0.3)')

      ctx.strokeStyle = gradient2
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
