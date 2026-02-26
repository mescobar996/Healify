'use client'

import { useSession, signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Wand2,
  FolderGit2,
  Activity,
  Github,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  Code,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TypewriterText } from '@/components/TypewriterText'
import { DashboardPreview } from '@/components/DashboardPreview'
import { HealifyLogo } from '@/components/HealifyLogo'
import { useEffect, useState } from 'react'

// Feature Card Component con Glassmorphism
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
      className={cn(
        'group glass-elite glass-elite-hover p-6 rounded-2xl',
        'stagger-' + (index + 1)
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00F5C8]/20 to-[#7B5EF8]/20 flex items-center justify-center mb-4 border border-[#00F5C8]/20 group-hover:border-[#00F5C8]/40 transition-colors">
        <Icon className="w-6 h-6 text-[#00F5C8]" />
      </div>
      <h3 className="text-lg font-bold text-[#E8F0FF] mb-2 font-heading">{title}</h3>
      <p className="text-sm text-[#E8F0FF]/60 leading-relaxed">{description}</p>
    </motion.div>
  )
}

// Stat Component con Count-up Animation
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
      <div className="text-xs text-[#E8F0FF]/60 uppercase tracking-wider">{label}</div>
    </motion.div>
  )
}

// Landing Hero
function LandingHero() {
  return (
    <div className="relative isolate overflow-hidden min-h-screen flex flex-col">
      {/* Background Grid Lines */}
      <div className="absolute inset-0 grid-lines opacity-30" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col justify-center py-24 sm:py-32">
        <div className="text-center space-y-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium glass-elite border border-[#00F5C8]/30 text-[#00F5C8] glow-pulse">
              <Sparkles className="w-3 h-3" />
              Now in Public Beta
            </span>
          </motion.div>

          {/* Headline con Typewriter Effect */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-[#E8F0FF] font-heading"
          >
            <TypewriterText text="Tests That Heal Themselves" speed={80} />
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-xl md:text-2xl text-[#00F5C8] max-w-3xl mx-auto font-mono"
          >
            Powered by AI · Zero Manual Maintenance
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              size="lg"
              className="h-14 px-8 btn-neon text-base font-semibold"
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            >
              <Github className="w-5 h-5 mr-2" />
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 glass-elite border-[#00F5C8]/30 text-[#E8F0FF] hover:border-[#00F5C8]/50 hover:bg-white/5"
              onClick={() => {
                const el = document.getElementById('demo-section')
                el ? el.scrollIntoView({ behavior: 'smooth' }) : signIn('github', { callbackUrl: '/dashboard' })
              }}
            >
              Watch Demo
            </Button>
          </motion.div>

          {/* Dashboard Preview Mockup Flotante — destino del botón "Watch Demo" */}
          <motion.div
            id="demo-section"
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.5, type: 'spring' }}
            className="mt-16 max-w-5xl mx-auto"
          >
            <DashboardPreview className="relative h-[280px] sm:h-[400px] lg:h-[600px]" />
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 pt-10 sm:pt-16 border-t border-white/10 mt-16"
          >
            <Stat value="500+" label="Teams" delay={0.7} />
            <Stat value="10K+" label="Tests Healed" delay={0.8} />
            <Stat value="98%" label="Accuracy" delay={0.9} />
            <Stat value="90%" label="Time Saved" delay={1.0} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// Features Section
function FeaturesSection() {
  const features = [
    {
      icon: Wand2,
      title: 'Self-Healing Selectors',
      description: 'AI automatically detects and fixes broken selectors with 98% accuracy. No more manual test maintenance.',
    },
    {
      icon: FolderGit2,
      title: 'GitHub Integration',
      description: 'Seamless integration with GitHub Actions. Auto-heal tests in your CI/CD pipeline.',
    },
    {
      icon: Activity,
      title: 'Real-time Analytics',
      description: 'Track healing events, confidence scores, and ROI metrics in real-time.',
    },
    {
      icon: Zap,
      title: 'Instant Healing',
      description: 'Tests heal themselves in seconds. Zero downtime, zero manual intervention.',
    },
    {
      icon: Shield,
      title: 'High Confidence',
      description: 'AI suggests fixes with confidence scores. Review or auto-apply with trust.',
    },
    {
      icon: Clock,
      title: 'Time Savings',
      description: 'Reduce test maintenance time by 90%. Focus on building, not fixing.',
    },
  ]

  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-[#E8F0FF] mb-4 font-heading">
            Powerful Features
          </h2>
          <p className="text-lg text-[#E8F0FF]/60 max-w-2xl mx-auto">
            Everything you need to keep your tests running smoothly
          </p>
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

// How It Works Section
function HowItWorksSection() {
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

  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-[#E8F0FF] mb-4 font-heading">
            How it works
          </h2>
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
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full glass-elite border border-[#00F5C8]/30 flex items-center justify-center text-[#00F5C8] font-bold text-lg glow-pulse">
                {item.step}
              </div>
              <div className="glass-elite glass-elite-hover p-8 rounded-2xl h-full">
                <item.icon className="w-10 h-10 text-[#00F5C8] mb-4" />
                <h3 className="text-xl font-bold text-[#E8F0FF] mb-2 font-heading">{item.title}</h3>
                <p className="text-sm text-[#E8F0FF]/60">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// CTA Section
function CTASection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-elite glass-elite-large p-6 sm:p-10 lg:p-12 rounded-3xl text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#E8F0FF] mb-4 font-heading">
            Ready to stop fixing broken tests?
          </h2>
          <p className="text-lg text-[#E8F0FF]/60 mb-8 max-w-lg mx-auto">
            Join 500+ teams who trust Healify to keep their tests running smoothly.
          </p>
          <Button
            size="lg"
            className="h-14 px-8 btn-neon text-base font-semibold"
            onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
          >
            <Github className="w-5 h-5 mr-2" />
            Start Free Trial
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-xs text-[#E8F0FF]/40 mt-4">No credit card required · 14-day free trial</p>
        </motion.div>
      </div>
    </section>
  )
}

// Footer
function Footer() {
  return (
    <footer className="relative py-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#E8F0FF]/60">
          <div className="flex items-center gap-3">
            <HealifyLogo size="sm" showText={true} />
          </div>
          <div className="flex items-center gap-6">
            <a href="/docs" className="hover:text-[#00F5C8] transition-colors">Documentation</a>
            <a href="https://github.com/mescobar996/Healify" target="_blank" rel="noopener noreferrer" className="hover:text-[#00F5C8] transition-colors">GitHub</a>
            <a href="mailto:support@healify.dev" className="hover:text-[#00F5C8] transition-colors">Support</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// Main Page
export default function HomePage() {
  const { status } = useSession()

  // Show loading while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00F5C8]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#E8F0FF] relative">
      {/* Navbar Glassmorphism */}
      <header className="sticky top-0 z-50 glass-elite border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <HealifyLogo size="md" showText={true} />
          <div className="flex items-center gap-4">
            <a href="/pricing" className="text-sm text-[#E8F0FF]/60 hover:text-[#00F5C8] transition-colors">
              Pricing
            </a>
            <Button
              variant="outline"
              size="sm"
              className="glass-elite border-[#00F5C8]/30 text-[#E8F0FF] hover:border-[#00F5C8]/50 hover:bg-white/5"
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            >
              <Github className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Landing Content */}
      <LandingHero />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
      <Footer />
    </div>
  )
}
