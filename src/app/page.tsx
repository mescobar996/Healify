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
import { HealingDemo } from '@/components/HealingDemo'
import { HealifyLogo } from '@/components/HealifyLogo'
import { BackgroundSpace } from '@/components/BackgroundSpace'
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
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mb-4 border border-white/15 group-hover:border-white/30 transition-colors">
        <Icon className="w-6 h-6 text-[#5E6AD2]" />
      </div>
      <h3 className="text-lg font-bold text-[#EDEDED] mb-2 font-heading">{title}</h3>
      <p className="text-sm text-[#EDEDED]/60 leading-relaxed">{description}</p>
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
      <div className="text-xs text-[#EDEDED]/60 uppercase tracking-wider">{label}</div>
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
          {/* Headline con Typewriter Effect */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-[#EDEDED] font-heading"
          >
            <TypewriterText text="Tests That Heal Themselves" speed={80} />
          </motion.h1>

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
              className="h-14 px-8 glass-elite border-white/15 text-[#EDEDED] hover:border-white/30 hover:bg-white/5"
              onClick={() => {
                const el = document.getElementById('demo-section')
                el ? el.scrollIntoView({ behavior: 'smooth' }) : signIn('github', { callbackUrl: '/dashboard' })
              }}
            >
              Watch Demo
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            className="text-sm text-[#EDEDED]/50"
          >
            Mirá el flujo completo en 15s: test falla → Healify analiza → selector curado → PR abierto.
            <br />
            <span className="text-[#5E6AD2]/70 text-xs">⚡ Demo pública — sin registro requerido</span>
          </motion.p>

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

          <div className="pt-10 sm:pt-14" id="demo-section">
            <HealingDemo embedded />
          </div>
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
          <h2 className="text-4xl sm:text-5xl font-bold text-[#EDEDED] mb-4 font-heading">
            Powerful Features
          </h2>
          <p className="text-lg text-[#EDEDED]/60 max-w-2xl mx-auto">
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
          <h2 className="text-4xl sm:text-5xl font-bold text-[#EDEDED] mb-4 font-heading">
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
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full glass-elite border border-white/25 flex items-center justify-center text-[#5E6AD2] font-bold text-lg glow-pulse">
                {item.step}
              </div>
              <div className="glass-elite glass-elite-hover p-8 rounded-2xl h-full">
                <item.icon className="w-10 h-10 text-[#5E6AD2] mb-4" />
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

// Video Demo Section — 90s screencast embed
function VideoDemoSection() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium glass-elite border border-white/20 text-[#5E6AD2] mb-4">
            <Code className="w-3 h-3" />
            90-Second Demo
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold text-[#EDEDED] mb-4 font-heading">
            See Healify in Action
          </h2>
          <p className="text-lg text-[#EDEDED]/60 max-w-2xl mx-auto">
            Watch the full healing workflow: test fails → AI analyzes the DOM → selector healed → PR opened automatically.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-2xl overflow-hidden glass-elite border border-white/10"
        >
          {/* Video placeholder — replace src with actual Loom/ScreenStudio embed when recorded */}
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#0A0A0A]">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full" />
                <div className="relative w-20 h-20 rounded-full glass-elite border border-white/25 flex items-center justify-center cursor-pointer group hover:border-white/45 transition-colors">
                  <div className="w-0 h-0 border-l-[18px] border-l-[#EDEDED] border-y-[11px] border-y-transparent ml-1.5 group-hover:border-l-white transition-colors" />
                </div>
              </div>
              <p className="text-sm text-[#EDEDED]/50 font-mono">
                demo-healify-90s.mp4
              </p>
              <p className="text-xs text-[#EDEDED]/30 mt-2">
                Video coming soon — grab with Loom or ScreenStudio and embed here
              </p>
            </div>
          </div>
          {/* When you have the video, replace the above with:
          <iframe 
            src="https://www.loom.com/embed/YOUR_VIDEO_ID" 
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allowFullScreen
          />
          */}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-8 mt-8 text-xs text-[#EDEDED]/40"
        >
          <span>🎯 98% accuracy</span>
          <span>⚡ 3.2s avg heal time</span>
          <span>🔄 Zero manual maintenance</span>
        </motion.div>
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
          <h2 className="text-3xl sm:text-4xl font-bold text-[#EDEDED] mb-4 font-heading">
            Ready to stop fixing broken tests?
          </h2>
          <p className="text-lg text-[#EDEDED]/60 mb-8 max-w-lg mx-auto">
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
          <p className="text-xs text-[#EDEDED]/40 mt-4">No credit card required · 14-day free trial</p>
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#EDEDED]/60">
          <div className="flex items-center gap-3">
            <HealifyLogo size="sm" showText={true} />
          </div>
          <div className="flex items-center gap-6">
            <a href="/docs" className="hover:text-[#5E6AD2] transition-colors">Documentation</a>
            <a href="https://github.com/mescobar996/Healify" target="_blank" rel="noopener noreferrer" className="hover:text-[#5E6AD2] transition-colors">GitHub</a>
            <a href="mailto:support@healify.dev" className="hover:text-[#5E6AD2] transition-colors">Support</a>
            <a href="/refund" className="hover:text-[#5E6AD2] transition-colors">Reembolsos</a>
            <a href="/privacy" className="hover:text-[#5E6AD2] transition-colors">Privacidad</a>
            <a href="/terms" className="hover:text-[#5E6AD2] transition-colors">Términos</a>
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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5E6AD2]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] relative">
      <BackgroundSpace />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] px-3 py-2 rounded-md bg-white text-[#0A0A0A] text-sm font-semibold"
      >
        Saltar al contenido principal
      </a>

      {/* Navbar Glassmorphism */}
      <header className="sticky top-0 z-50 glass-elite border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-3">
          <HealifyLogo size="md" showText={true} />
          <nav aria-label="Principal" className="flex items-center gap-3 sm:gap-4">
            <a href="/pricing" className="text-sm text-[#EDEDED]/60 hover:text-[#5E6AD2] transition-colors">
              Pricing
            </a>
            <Button
              variant="outline"
              size="sm"
              className="glass-elite border-white/20 text-[#EDEDED] hover:border-white/35 hover:bg-white/5"
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            >
              <Github className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </nav>
        </div>
      </header>

      {/* Landing Content */}
      <main id="main-content">
        <LandingHero />
        <VideoDemoSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
