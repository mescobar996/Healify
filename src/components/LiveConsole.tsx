'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Circle, CheckCircle2, XCircle, Brain, RefreshCw, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

export interface LogEntry {
  id: string
  timestamp: Date
  type: 'info' | 'failure' | 'analyzing' | 'success' | 'error'
  message: string
  details?: string
  confidence?: number
}

// ============================================
// LOG ITEM COMPONENT
// ============================================

function LogItem({ log, index }: { log: LogEntry; index: number }) {
  const [copied, setCopied] = useState(false)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const getIcon = () => {
    switch (log.type) {
      case 'failure':
        return <Circle className="w-3 h-3 text-red-400 fill-red-400 animate-pulse" />
      case 'analyzing':
        return <Brain className="w-3 h-3 text-purple-400 animate-pulse" />
      case 'success':
        return <CheckCircle2 className="w-3 h-3 text-emerald-400" />
      case 'error':
        return <XCircle className="w-3 h-3 text-red-400" />
      default:
        return <Circle className="w-3 h-3 text-gray-400" />
    }
  }

  const getTextColor = () => {
    switch (log.type) {
      case 'failure': return 'text-red-300'
      case 'analyzing': return 'text-purple-300'
      case 'success': return 'text-emerald-300'
      case 'error': return 'text-red-400'
      default: return 'text-gray-300'
    }
  }

  const handleCopy = () => {
    if (log.details) {
      navigator.clipboard.writeText(log.details)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-start gap-3 py-2 px-3 rounded-lg group',
        'hover:bg-white/[0.03] transition-colors'
      )}
    >
      {/* Timestamp */}
      <span className="text-[11px] text-gray-600 font-mono w-[70px] flex-shrink-0">
        [{formatTime(log.timestamp)}]
      </span>

      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-mono', getTextColor())}>
          {log.message}
        </p>
        
        {log.details && (
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded">
              {log.details}
            </code>
            <button
              onClick={handleCopy}
              className={cn(
                'p-1 rounded opacity-0 group-hover:opacity-100 transition-all',
                copied ? 'bg-emerald-500/20' : 'bg-white/5 hover:bg-white/10'
              )}
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-gray-500" />
              )}
            </button>
          </div>
        )}

        {log.confidence && (
          <span className={cn(
            'text-xs font-mono mt-1 inline-block',
            log.confidence >= 0.9 ? 'text-emerald-400' : 
            log.confidence >= 0.7 ? 'text-amber-400' : 'text-red-400'
          )}>
            (Confidence: {Math.round(log.confidence * 100)}%)
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ============================================
// LIVE CONSOLE COMPONENT
// ============================================

interface LiveConsoleProps {
  projectId: string
  initialLogs?: LogEntry[]
}

export function LiveConsole({ projectId, initialLogs = [] }: LiveConsoleProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(true)
  const consoleRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (consoleRef.current && isStreaming) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs, isStreaming])

  // Simulate real-time logs (in production, use WebSocket)
  useEffect(() => {
    if (!isStreaming) return

    // Simulate connection
    setTimeout(() => setIsConnected(true), 500)

    // Simulate incoming logs
    const mockLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 5000),
        type: 'failure',
        message: 'Failure detected: login.spec.ts',
        details: '#login-btn',
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 4000),
        type: 'analyzing',
        message: 'AI Analyzing selector...',
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 3000),
        type: 'success',
        message: 'Fixed: role("button", { name: "Login" })',
        details: 'role("button", { name: "Login" })',
        confidence: 0.92,
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 2000),
        type: 'info',
        message: 'Test re-run initiated',
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 1000),
        type: 'success',
        message: 'Test passed: login.spec.ts',
      },
    ]

    // Add logs with delay
    mockLogs.forEach((log, i) => {
      setTimeout(() => {
        setLogs(prev => [...prev, log])
      }, 1000 + i * 800)
    })

    // Cleanup
    return () => {}
  }, [isStreaming, projectId])

  return (
    <div className="glass-elite overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Live Console</span>
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium',
            isConnected 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : 'bg-amber-500/10 text-amber-400'
          )}>
            <Circle className={cn(
              'w-1.5 h-1.5',
              isConnected ? 'fill-emerald-400' : 'fill-amber-400 animate-pulse'
            )} />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
        
        <button
          onClick={() => setIsStreaming(!isStreaming)}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            isStreaming 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          )}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isStreaming && 'animate-spin')} />
        </button>
      </div>

      {/* Console Output */}
      <div 
        ref={consoleRef}
        className="h-[300px] overflow-y-auto p-2 font-mono text-sm"
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace"
        }}
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-sm">Waiting for events...</p>
          </div>
        ) : (
          <AnimatePresence>
            {logs.map((log, index) => (
              <LogItem key={log.id} log={log} index={index} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02]">
        <span className="text-[10px] text-gray-600 font-mono">
          PROJECT_ID: {projectId} | STREAM: {isStreaming ? 'ACTIVE' : 'PAUSED'}
        </span>
      </div>
    </div>
  )
}

export default LiveConsole