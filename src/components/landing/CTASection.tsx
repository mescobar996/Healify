'use client'

import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { ArrowRight, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CTASection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-elite glass-elite-large p-6 sm:p-10 lg:p-12 rounded-3xl text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#EDEDED] mb-4 font-heading">
            ¿Listo para dejar de reparar tests rotos?
          </h2>
          <p className="text-lg text-[#EDEDED]/60 mb-8 max-w-lg mx-auto">
            Más de 500 equipos confían en Healify para mantener sus tests funcionando.
          </p>
          <Button
            size="lg"
            className="h-14 px-8 btn-neon text-base font-semibold"
            onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
          >
            <Github className="w-5 h-5 mr-2" />
            Empezar prueba gratis
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-xs text-[#EDEDED]/40 mt-4">Sin tarjeta de crédito · 14 días de prueba gratis</p>
        </motion.div>
      </div>
    </section>
  )
}
