'use client'

import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { ArrowRight, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TypewriterText } from '@/components/TypewriterText'
import { HealingDemo } from '@/components/HealingDemo'
import { useEffect, useState } from 'react'

function Stat({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) {
  const [count, setCount] = useState(0)
  const numericValue = parseInt(value.replace(/[^0-9]/g, ''))
  const suffix = value.replace(/[0-9]/g, '')

  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = numericValue / steps
    let current = 0

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        current += increment
        if (current >= numericValue) {
          setCount(numericValue)
          clearInterval(interval)
        } else {
          setCount(Math.floor(current))
        }
      }, duration / steps)
      return () => clearInterval(interval)
    }, delay * 1000)

    return () => clearTimeout(timer)
  }, [numericValue, delay])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="text-center"
    >
      <div className="text-4xl font-bold text-gradient font-heading mb-2">
        {count}{suffix}
      </div>
      <div className="text-xs text-[#EDEDED]/60 uppercase tracking-wider">{label}</div>
    </motion.div>
  )
}

export default function LandingHero() {
  useEffect(() => {
    fetch('/api/analytics/funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'landing_view' }),
    }).catch(() => {})
  }, [])

  return (
    <div className="relative isolate overflow-hidden min-h-screen flex flex-col">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col justify-center py-24 sm:py-32">
        <div className="text-center space-y-8">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-[#EDEDED] font-heading"
          >
            <TypewriterText text="Tests que se curan solos" speed={80} />
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              size="lg"
              className="h-14 px-8 w-full sm:w-auto btn-neon text-base font-semibold"
              onClick={() => {
                fetch('/api/analytics/funnel', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ event: 'signup_start' }),
                }).catch(() => {})
                signIn('github', { callbackUrl: '/dashboard' })
              }}
            >
              <Github className="w-5 h-5 mr-2" />
              Empezar gratis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 w-full sm:w-auto glass-elite border-white/15 text-[#EDEDED] hover:border-white/30 hover:bg-white/5"
              onClick={() => {
                const el = document.getElementById('demo-section')
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' })
                } else {
                  signIn('github', { callbackUrl: '/dashboard' })
                }
              }}
            >
              Ver Demo
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            className="text-sm text-[#EDEDED]/50"
          >
            Mirá el flujo completo en 15s: test falla → Healify analiza → selector curado → PR abierto.{" "}
            <span className="text-white/70 text-xs block sm:inline mt-1 sm:mt-0">⚡ Demo pública — sin registro requerido</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 pt-10 sm:pt-16 border-t border-white/10 mt-16"
          >
            <Stat value="500+" label="Equipos" delay={0.7} />
            <Stat value="10K+" label="Tests curados" delay={0.8} />
            <Stat value="98%" label="Precisión" delay={0.9} />
            <Stat value="90%" label="Tiempo ahorrado" delay={1.0} />
          </motion.div>

          <div className="pt-10 sm:pt-14" id="demo-section">
            <HealingDemo embedded />
          </div>
        </div>
      </div>
    </div>
  )
}
