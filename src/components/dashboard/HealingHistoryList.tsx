"use client"

import React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { ConfidenceBar } from "@/components/dashboard/ConfidenceBar"
import { EmptyState } from "@/components/dashboard/EmptyState"
import type { HealingHistoryItem } from "@/types"

interface HealingHistoryListProps {
  items: HealingHistoryItem[]
  onOpenDetail: (item: HealingHistoryItem) => void
}

export function HealingHistoryList({ items, onOpenDetail }: HealingHistoryListProps) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)]">
      {/* List Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            Últimas Curaciones
          </h2>
          <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        </div>
        <button className="min-h-[44px] px-2 inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowUpDown className="w-3 h-3" />
          Ordenar
        </button>
      </div>

      {/* List Items */}
      {items.length === 0 ? (
        <div className="px-4 py-8">
          <EmptyState
            title="No hay eventos de curación"
            description="Los eventos aparecerán cuando se ejecuten tests con fallos"
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
            >
              <button
                onClick={() => onOpenDetail(item)}
                className="group w-full px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left"
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {item.status === "curado" ? (
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    ) : item.status === "fallido" ? (
                      <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center">
                        <XCircle className="w-3 h-3 text-red-400" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                        <Clock className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate transition-colors">
                      {item.testName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-[11px] text-[var(--text-tertiary)] font-mono truncate max-w-[100px] sm:max-w-[200px]">
                        {item.oldSelector}
                      </code>
                      {item.newSelector && (
                        <>
                          <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] flex-shrink-0" />
                          <code className="text-[11px] text-white font-mono truncate max-w-[100px] sm:max-w-[200px]">
                            {item.newSelector}
                          </code>
                        </>
                      )}
                    </div>

                    <div className="flex md:hidden items-center gap-2 mt-1.5">
                      <StatusBadge status={item.status} />
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                        {item.confidence}%
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">{item.timestamp}</span>
                    </div>
                  </div>

                  {/* Desktop Metadata */}
                  <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                    <ConfidenceBar confidence={item.confidence} />
                    <StatusBadge status={item.status} />
                    <span className="text-[11px] text-[var(--text-tertiary)] w-20 text-right">
                      {item.timestamp}
                    </span>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="hidden md:block w-4 h-4 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* List Footer */}
      {items.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
          <Link
            href="/dashboard/tests"
            className="flex items-center justify-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Ver todos los tests
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
}
