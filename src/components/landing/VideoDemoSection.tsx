'use client'

import { motion } from 'framer-motion'
import { Code } from 'lucide-react'

export default function VideoDemoSection() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium glass-elite border border-white/20 text-white mb-4">
            <Code className="w-3 h-3" />
            90-Second Demo
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold text-[#EDEDED] mb-4 font-heading">See Healify in Action</h2>
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
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#0A0A0A]">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full" />
                <div className="relative w-20 h-20 rounded-full glass-elite border border-white/25 flex items-center justify-center cursor-pointer group hover:border-white/45 transition-colors">
                  <div className="w-0 h-0 border-l-[18px] border-l-[#EDEDED] border-y-[11px] border-y-transparent ml-1.5 group-hover:border-l-white transition-colors" />
                </div>
              </div>
              <p className="text-sm text-[#EDEDED]/50 font-mono">demo-healify-90s.mp4</p>
              <p className="text-xs text-[#EDEDED]/30 mt-2">Video coming soon</p>
            </div>
          </div>
          {/* Replace with Loom embed when recorded:
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
