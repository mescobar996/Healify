"use client"

import React, { useState } from "react"
import { Share2, Twitter, Linkedin, Copy, Check } from "lucide-react"
import { trackEvent } from "@/lib/track"

interface ShareSavingsProps {
  timeSavedHours: number
  totalCostSaved: number
  healingRate: number
  autoHealedMonth: number
}

export function ShareSavings({
  timeSavedHours,
  totalCostSaved,
  healingRate,
  autoHealedMonth,
}: ShareSavingsProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const text = [
    `🩹 Healify ahorra a mi equipo ${timeSavedHours}h/mes`,
    `y ~$${totalCostSaved.toLocaleString()} en mantenimiento de tests.`,
    `${autoHealedMonth} tests autocurados este mes con ${healingRate}% de tasa de éxito.`,
    ``,
    `#TestAutomation #SelfHealing #QA`,
    `https://healify-sigma.vercel.app`,
  ].join("\n")

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    "https://healify-sigma.vercel.app"
  )}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      trackEvent("share_savings_copy")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard denied — silent */
    }
  }

  const handleOpen = () => {
    setOpen((prev) => !prev)
    if (!open) trackEvent("share_savings_open")
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Compartir ahorro
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xl p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium">
              Compartir resultados
            </p>

            {/* Preview */}
            <div className="rounded-md bg-[var(--bg-elevated)] p-2.5 text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
              {text}
            </div>

            <div className="flex items-center gap-2">
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("share_savings_twitter")}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2.5 py-2 text-[11px] text-[var(--text-secondary)] hover:text-white hover:border-white/20 transition-colors"
              >
                <Twitter className="w-3.5 h-3.5" />
                X
              </a>
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("share_savings_linkedin")}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2.5 py-2 text-[11px] text-[var(--text-secondary)] hover:text-white hover:border-white/20 transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5" />
                LinkedIn
              </a>
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2.5 py-2 text-[11px] text-[var(--text-secondary)] hover:text-white hover:border-white/20 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
