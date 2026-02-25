'use client'

import { Skeleton } from '@/components/ui/skeleton'

// ============================================
// DASHBOARD SKELETON
// ============================================
export function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32 bg-white/[0.04]" />
          <Skeleton className="h-4 w-52 bg-white/[0.04]" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-9 w-28 bg-white/[0.04] rounded-lg" />
          <Skeleton className="h-9 w-36 bg-white/[0.04] rounded-lg" />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2.5">
                <Skeleton className="h-3 w-20 bg-white/[0.04]" />
                <Skeleton className="h-8 w-16 bg-white/[0.04]" />
              </div>
              <Skeleton className="h-9 w-9 rounded-xl bg-white/[0.04]" />
            </div>
            <Skeleton className="h-3 w-24 bg-white/[0.04]" />
          </div>
        ))}
      </div>

      {/* ROI Strip */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <Skeleton className="h-3 w-56 bg-white/[0.04]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-3.5">
              <Skeleton className="w-9 h-9 rounded-xl bg-white/[0.04]" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-12 bg-white/[0.04]" />
                <Skeleton className="h-2.5 w-20 bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart + Selectors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36 bg-white/[0.04]" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-16 bg-white/[0.04]" />
              <Skeleton className="h-3 w-16 bg-white/[0.04]" />
            </div>
          </div>
          <Skeleton className="h-52 w-full bg-white/[0.04] rounded-lg" />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <Skeleton className="h-4 w-32 bg-white/[0.04]" />
          </div>
          <div className="px-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <Skeleton className="w-1.5 h-1.5 rounded-full bg-white/[0.04]" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32 bg-white/[0.04]" />
                  <Skeleton className="h-2.5 w-20 bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity + History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, j) => (
          <div key={j} className="rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06]">
              <Skeleton className="h-4 w-32 bg-white/[0.04]" />
            </div>
            <div className="divide-y divide-white/[0.04]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <Skeleton className="h-6 w-6 rounded-full bg-white/[0.04] flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-48 bg-white/[0.04]" />
                    <Skeleton className="h-2.5 w-32 bg-white/[0.04]" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// PROJECTS SKELETON
// ============================================
export function ProjectsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24 bg-white/[0.04]" />
          <Skeleton className="h-4 w-48 bg-white/[0.04]" />
        </div>
        <Skeleton className="h-9 w-36 bg-white/[0.04] rounded-lg" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64 bg-white/[0.04] rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32 bg-white/[0.04]" />
                <Skeleton className="h-3 w-48 bg-white/[0.04]" />
              </div>
              <Skeleton className="h-6 w-6 rounded bg-white/[0.04]" />
            </div>
            <div className="space-y-2 pt-3 border-t border-white/[0.06]">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-white/[0.04]" />
                <Skeleton className="h-3 w-12 bg-white/[0.04]" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24 bg-white/[0.04]" />
                <Skeleton className="h-3 w-16 bg-white/[0.04]" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-full bg-white/[0.04] rounded-lg" />
              <Skeleton className="h-8 w-8 bg-white/[0.04] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// TEST RUNS SKELETON
// ============================================
export function TestRunsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28 bg-white/[0.04]" />
          <Skeleton className="h-4 w-44 bg-white/[0.04]" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-9 w-28 bg-white/[0.04] rounded-lg" />
          <Skeleton className="h-9 w-36 bg-white/[0.04] rounded-lg" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64 bg-white/[0.04] rounded-lg" />
        <Skeleton className="h-9 w-36 bg-white/[0.04] rounded-lg" />
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16 bg-white/[0.04]" />
          ))}
        </div>
        <div className="divide-y divide-white/[0.04]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="h-6 w-6 rounded-full bg-white/[0.04] flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-56 bg-white/[0.04]" />
                <Skeleton className="h-2.5 w-36 bg-white/[0.04]" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full bg-white/[0.04]" />
              <Skeleton className="h-4 w-12 bg-white/[0.04]" />
              <Skeleton className="h-4 w-20 bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
