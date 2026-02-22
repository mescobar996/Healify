'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, X, Twitter, Copy, Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ============================================
// SHARE SAVINGS COMPONENT
// ============================================

interface ShareSavingsProps {
  hoursSaved: number
  testsHealed: number
  className?: string
}

export function ShareSavings({ hoursSaved, testsHealed, className }: ShareSavingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const tweetText = `🚀 Healify acaba de ahorrarme ${hoursSaved} horas de mantenimiento de tests con su IA de autocuración. 

✅ ${testsHealed} tests autocurados
⚡ Configuración en 2 minutos

¡Pruébalo gratis! 👇
https://healify-sigma.vercel.app

#Testing #AI #DeveloperTools`

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`

  const handleShareTwitter = () => {
    window.open(tweetUrl, '_blank', 'width=550,height=420')
    setIsOpen(false)
    toast.success('Thanks for sharing! 🎉')
  }

  const handleCopyText = () => {
    navigator.clipboard.writeText(tweetText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard!')
  }

  return (
    <>
      {/* Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl',
          'bg-gradient-to-r from-cyan-500/10 to-purple-500/10',
          'border border-cyan-500/20 hover:border-cyan-500/40',
          'text-cyan-400 hover:text-cyan-300',
          'transition-all duration-300',
          'group',
          className
        )}
      >
        <Share2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
        <span className="text-sm font-medium">Share My Savings</span>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
            >
              <div className="glass-elite p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Clock className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Share Your Savings</h3>
                      <p className="text-sm text-gray-400">You've saved {hoursSaved} hours!</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-2xl font-bold text-white">{hoursSaved}h</span>
                    <p className="text-xs text-gray-500 mt-1">Time Saved</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-2xl font-bold text-white">{testsHealed}</span>
                    <p className="text-xs text-gray-500 mt-1">Tests Healed</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/10 mb-6">
                  <p className="text-sm text-gray-300 whitespace-pre-line font-mono">
                    {tweetText.slice(0, 200)}...
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleShareTwitter}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-medium transition-colors"
                  >
                    <Twitter className="w-5 h-5" />
                    Share on X
                  </button>
                  <button
                    onClick={handleCopyText}
                    className={cn(
                      'px-4 py-3 rounded-xl transition-all',
                      copied
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    )}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default ShareSavings