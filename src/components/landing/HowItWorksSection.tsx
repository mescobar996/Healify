'use client'

import { motion } from 'framer-motion'
import { FolderGit2, Shield, Zap } from 'lucide-react'

const steps = [
  {
    step: '1',
    title: 'Connect',
    description: 'Link your GitHub repository and CI/CD pipeline in minutes.',
    icon: FolderGit2,
  },
  {
    step: '2',
    title: 'Detect',
    description: 'Healify monitors test failures and identifies broken selectors.',
    icon: Shield,
  },
  {
    step: '3',
    title: 'Heal',
    description: 'AI suggests fixes with confidence scores. Auto-apply or review.',
    icon: Zap,
  },
]

export default function HowItWorksSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-[#EDEDED] mb-4 font-heading">How it works</h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="relative"
            >
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full glass-elite border border-white/25 flex items-center justify-center text-white font-bold text-lg glow-pulse">
                {item.step}
              </div>
              <div className="glass-elite glass-elite-hover p-8 rounded-2xl h-full">
                <item.icon className="w-10 h-10 text-white mb-4" />
                <h3 className="text-xl font-bold text-[#EDEDED] mb-2 font-heading">{item.title}</h3>
                <p className="text-sm text-[#EDEDED]/60">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
