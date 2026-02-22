'use client'

import { motion } from 'framer-motion'
import { WaveChart } from './WaveChart'
import { Search, Bell, Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className={cn('glass-elite glass-elite-large p-6', className)}
    >
      {/* Sidebar Izquierda */}
      <div className="absolute left-0 top-0 bottom-0 w-16 glass-elite rounded-r-2xl flex flex-col items-center py-4 gap-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7B5EF8] to-[#00F5C8] flex items-center justify-center text-[#0A0E1A] font-bold">
          +
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10"
            />
          ))}
        </div>
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7B5EF8] to-[#00F5C8] opacity-60" />
      </div>

      {/* Header */}
      <div className="ml-20 mb-4 flex items-center gap-4">
        <div className="flex-1 glass-elite px-4 py-2 rounded-xl flex items-center gap-3">
          <Search className="w-4 h-4 text-[#E8F0FF] opacity-60" />
          <span className="text-sm text-[#E8F0FF] opacity-40">Search...</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 glass-elite rounded-lg flex items-center justify-center">
            <Settings className="w-4 h-4 text-[#E8F0FF] opacity-60" />
          </div>
          <div className="w-8 h-8 glass-elite rounded-lg flex items-center justify-center">
            <Bell className="w-4 h-4 text-[#E8F0FF] opacity-60" />
          </div>
          <div className="w-8 h-8 glass-elite rounded-lg flex items-center justify-center">
            <User className="w-4 h-4 text-[#E8F0FF] opacity-60" />
          </div>
        </div>
        <div className="px-3 py-1 rounded-full bg-[#00F5C8] text-[#0A0E1A] text-xs font-bold">
          01:00
        </div>
      </div>

      {/* Panel Central - Wave Chart */}
      <div className="ml-20 mb-4 glass-elite rounded-2xl p-4 h-64">
        <WaveChart className="w-full h-full" />
      </div>

      {/* KPI Cards Grid 2x2 */}
      <div className="ml-20 mb-4 grid grid-cols-2 gap-3">
        {[
          { label: 'Tests Healed', value: '1,234', trend: '+12%' },
          { label: 'Success Rate', value: '98.5%', trend: '+2.1%' },
          { label: 'Time Saved', value: '45h', trend: '+8h' },
          { label: 'Projects', value: '24', trend: '+3' },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="glass-elite p-4 rounded-xl"
          >
            <div className="text-xs text-[#E8F0FF] opacity-60 mb-1">{kpi.label}</div>
            <div className="text-xl font-bold text-[#E8F0FF] mb-1">{kpi.value}</div>
            <div className="text-xs text-[#00F5C8]">{kpi.trend}</div>
          </motion.div>
        ))}
      </div>

      {/* Activity Cards */}
      <div className="ml-20 grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.1 }}
            className="glass-elite p-4 rounded-xl flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00F5C8] to-[#7B5EF8] opacity-60" />
            <div className="flex-1">
              <div className="h-1 bg-white/10 rounded-full mb-2">
                <div className="h-full bg-gradient-to-r from-[#00F5C8] to-[#7B5EF8] rounded-full" style={{ width: `${60 + i * 10}%` }} />
              </div>
              <div className="text-xs text-[#E8F0FF] opacity-60">Activity {i}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Code Snippet Bottom Right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-4 right-4 glass-elite p-4 rounded-xl w-64"
      >
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="h-2 w-16 bg-[#00F5C8] rounded-full opacity-60" />
            <div className="h-2 w-12 bg-[#7B5EF8] rounded-full opacity-40" />
          </div>
          <div className="flex gap-2">
            <div className="h-2 w-20 bg-[#FF6B9D] rounded-full opacity-50" />
            <div className="h-2 w-8 bg-[#00F5C8] rounded-full opacity-30" />
          </div>
          <div className="flex gap-2">
            <div className="h-2 w-14 bg-[#7B5EF8] rounded-full opacity-60" />
            <div className="h-2 w-10 bg-[#FF6BFF] rounded-full opacity-40" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
