'use client'

import { motion } from 'framer-motion'
import { Wand2, FolderGit2, Activity, Zap, Shield, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

function FeatureCard({
  icon: Icon,
  title,
  description,
  delay = 0,
  index,
}: {
  icon: React.ElementType
  title: string
  description: string
  delay?: number
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: delay + index * 0.1 }}
      className={cn('group glass-elite glass-elite-hover p-6 rounded-2xl', 'stagger-' + (index + 1))}
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mb-4 border border-white/15 group-hover:border-white/30 transition-colors">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-bold text-[#EDEDED] mb-2 font-heading">{title}</h3>
      <p className="text-sm text-[#EDEDED]/60 leading-relaxed">{description}</p>
    </motion.div>
  )
}

const features = [
  { icon: Wand2, title: 'Self-Healing Selectors', description: 'AI automatically detects and fixes broken selectors with 98% accuracy. No more manual test maintenance.' },
  { icon: FolderGit2, title: 'GitHub Integration', description: 'Seamless integration with GitHub Actions. Auto-heal tests in your CI/CD pipeline.' },
  { icon: Activity, title: 'Real-time Analytics', description: 'Track healing events, confidence scores, and ROI metrics in real-time.' },
  { icon: Zap, title: 'Instant Healing', description: 'Tests heal themselves in seconds. Zero downtime, zero manual intervention.' },
  { icon: Shield, title: 'High Confidence', description: 'AI suggests fixes with confidence scores. Review or auto-apply with trust.' },
  { icon: Clock, title: 'Time Savings', description: 'Reduce test maintenance time by 90%. Focus on building, not fixing.' },
]

export default function FeaturesSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-[#EDEDED] mb-4 font-heading">Powerful Features</h2>
          <p className="text-lg text-[#EDEDED]/60 max-w-2xl mx-auto">Everything you need to keep your tests running smoothly</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <FeatureCard
              key={i}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={0.1}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
