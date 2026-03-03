"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  Github,
  Zap,
  CheckCircle2,
  ArrowRight,
  X,
  FolderPlus,
  Webhook,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════════════
// ONBOARDING BANNER — Se muestra cuando el usuario tiene 0 proyectos
// Guía al usuario en 3 pasos para conectar su primer repo y ver Healify
// en acción.
// ═══════════════════════════════════════════════════════════════════════

const STEPS = [
  {
    step: 1,
    icon: FolderPlus,
    title: "Crear tu primer proyecto",
    description: "Dale un nombre y pegá la URL de tu repositorio de GitHub.",
    action: "Crear proyecto",
    color: "text-[#00F5C8]",
    bg: "bg-[#00F5C8]/10",
    border: "border-[#00F5C8]/20",
  },
  {
    step: 2,
    icon: Webhook,
    title: "Conectar el Webhook",
    description:
      "Healify escucha cada push. Cada commit dispara los tests automáticamente.",
    action: "Ver instrucciones",
    color: "text-[#7B5EF8]",
    bg: "bg-[#7B5EF8]/10",
    border: "border-[#7B5EF8]/20",
  },
  {
    step: 3,
    icon: Zap,
    title: "Healify autocura tus tests",
    description:
      "Cuando un selector se rompe, la IA detecta el nuevo selector y crea un PR automático.",
    action: null,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
]

// ─── Compatible Tools Strip ──────────────────────────────────────────
const TOOLS = [
  {
    name: "Playwright",
    color: "#2ECC40",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#2ECC40" fillOpacity="0.2"/>
        <path d="M8 8l8 4-8 4V8z" fill="#2ECC40"/>
      </svg>
    ),
  },
  {
    name: "Cypress",
    color: "#69D3A7",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <circle cx="12" cy="12" r="10" stroke="#69D3A7" strokeWidth="2" fill="none"/>
        <path d="M12 7a5 5 0 100 10A5 5 0 0012 7z" fill="#69D3A7" fillOpacity="0.3"/>
        <circle cx="12" cy="12" r="2" fill="#69D3A7"/>
      </svg>
    ),
  },
  {
    name: "Jest",
    color: "#C21325",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#C21325" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: "Selenium",
    color: "#43B02A",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#43B02A"/>
      </svg>
    ),
  },
  {
    name: "GitHub",
    color: "#E8F0FF",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#E8F0FF]/70">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
  },
  {
    name: "GitHub Actions",
    color: "#2088FF",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" fill="#2088FF" fillOpacity="0.2" stroke="#2088FF" strokeWidth="1.5"/>
        <path d="M9 12l2 2 4-4" stroke="#2088FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: "TypeScript",
    color: "#3178C6",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <rect width="24" height="24" rx="3" fill="#3178C6" fillOpacity="0.15"/>
        <path d="M14 9h-4v2h1.5v5H13v-5H14V9zM15 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5H17v1h.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5" stroke="#3178C6" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: "Python",
    color: "#3776AB",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M12 2C8.5 2 9 3.5 9 5v2h6V8H7C4.8 8 3 9.8 3 12s1.8 4 4 4h1v-2.5C8 12 9.3 11 11 11h6c1.7 0 3-1.3 3-3V7c0-2.8-2.2-5-5-5h-3z" fill="#3776AB" fillOpacity="0.8"/>
        <path d="M12 22c3.5 0 3-1.5 3-3v-2H9v-1h8c2.2 0 4-1.8 4-4s-1.8-4-4-4h-1v2.5C16 12 14.7 13 13 13H7c-1.7 0-3 1.3-3 3v3c0 2.8 2.2 5 5 5h3z" fill="#FFD43B" fillOpacity="0.8"/>
      </svg>
    ),
  },
]

function CompatibleTools() {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-widest text-[#E8F0FF]/25 uppercase mb-2.5">
        Compatible con
      </p>
      <div className="flex flex-wrap gap-2">
        {TOOLS.map((tool) => (
          <div
            key={tool.name}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-150 cursor-default group"
          >
            {tool.svg}
            <span
              className="text-[11px] font-medium text-[#E8F0FF]/50 group-hover:text-[#E8F0FF]/70 transition-colors"
            >
              {tool.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepCard({
  step,
  index,
  isCompleted,
}: {
  step: (typeof STEPS)[0]
  index: number
  isCompleted: boolean
}) {
  const Icon = step.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "flex-1 min-w-0 rounded-xl border p-4 transition-all duration-200",
        isCompleted
          ? "border-emerald-500/30 bg-emerald-500/5"
          : step.border + " " + step.bg
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            isCompleted ? "bg-emerald-500/20" : step.bg
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Icon className={cn("w-4 h-4", step.color)} />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                isCompleted ? "text-emerald-400" : step.color
              )}
            >
              Paso {step.step}
            </span>
          </div>
          <p className="text-[13px] font-medium text-white leading-tight">
            {step.title}
          </p>
          <p className="text-[11px] text-[#E8F0FF]/50 mt-1 leading-relaxed">
            {step.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

interface OnboardingBannerProps {
  userName?: string
  onDismiss?: () => void
  progress?: {
    projectConnected: boolean
    firstRunExecuted: boolean
    firstHealingDone: boolean
  }
  onSetupSandbox?: () => Promise<void> | void
}

export function OnboardingBanner({
  userName,
  onDismiss,
  progress,
  onSetupSandbox,
}: OnboardingBannerProps) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [sandboxLoading, setSandboxLoading] = useState(false)

  const completedByStep = {
    1: progress?.projectConnected ?? false,
    2: progress?.firstRunExecuted ?? false,
    3: progress?.firstHealingDone ?? false,
  }

  const completedCount = Object.values(completedByStep).filter(Boolean).length

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
    // Guardar preferencia en localStorage
    try {
      localStorage.setItem("healify_onboarding_dismissed", "true")
    } catch {}
  }

  const handleSetupSandbox = async () => {
    if (!onSetupSandbox) return
    try {
      setSandboxLoading(true)
      await onSetupSandbox()
    } finally {
      setSandboxLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className="relative rounded-2xl overflow-hidden border border-[#00F5C8]/20"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,245,200,0.04) 0%, rgba(123,94,248,0.06) 50%, rgba(10,14,26,0.8) 100%)",
          }}
        >
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-[#E8F0FF]/30 hover:text-[#E8F0FF]/70 hover:bg-white/5 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-5">
            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00F5C8]/20 to-[#7B5EF8]/20 flex items-center justify-center shrink-0 border border-[#00F5C8]/20">
                <Zap className="w-4 h-4 text-[#00F5C8]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white leading-tight">
                  {userName
                    ? `Bienvenido, ${userName.split(" ")[0]} 👋`
                    : "Bienvenido a Healify 👋"}
                </h2>
                <p className="text-[12px] text-[#E8F0FF]/50 mt-0.5">
                  Conectá tu primer repositorio para que Healify empiece a
                  autocurar tus tests.
                </p>
                <p className="text-[11px] text-[#00F5C8]/70 mt-1">
                  Progreso: {completedCount}/3 pasos completados
                </p>
              </div>
            </div>

            {/* Steps */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              {STEPS.map((step, i) => (
                <StepCard
                  key={step.step}
                  step={step}
                  index={i}
                  isCompleted={completedByStep[step.step as 1 | 2 | 3]}
                />
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Button
                onClick={() => router.push("/dashboard/projects?new=true")}
                className="bg-[#00F5C8] hover:bg-[#00F5C8]/90 text-[#0A0E1A] font-semibold text-sm h-9 px-5 w-full sm:w-auto"
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Crear mi primer proyecto
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>

              <Button
                variant="ghost"
                onClick={handleSetupSandbox}
                className="text-[#E8F0FF]/50 hover:text-[#E8F0FF] text-sm h-9 px-4 w-full sm:w-auto"
                disabled={sandboxLoading}
              >
                <Github className="w-4 h-4 mr-2" />
                {sandboxLoading ? "Creando sandbox..." : "Activar sandbox demo"}
              </Button>

              <button
                onClick={handleDismiss}
                className="text-[11px] text-[#E8F0FF]/25 hover:text-[#E8F0FF]/50 transition-colors sm:ml-auto whitespace-nowrap"
              >
                Saltar por ahora
              </button>
            </div>

            {/* Demo shortcut hint */}
            <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
              <div className="flex items-center gap-2">
                <Play className="w-3 h-3 text-[#E8F0FF]/25 shrink-0" />
                <p className="text-[10px] text-[#E8F0FF]/30">
                  ¿Querés ver cómo funciona sin configurar nada?{" "}
                  <button
                    onClick={() => router.push("/api/seed")}
                    className="text-[#00F5C8]/50 hover:text-[#00F5C8] transition-colors underline underline-offset-2"
                  >
                    Cargar datos de demo
                  </button>
                </p>
              </div>

              <CompatibleTools />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
