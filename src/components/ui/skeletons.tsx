'use client'

import { Skeleton } from '@/components/ui/skeleton'

// ============================================
// DASHBOARD SKELETON
// ============================================
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32 bg-white/5" />
          <Skeleton className="h-4 w-52 bg-white/5" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 bg-white/5" />
          <Skeleton className="h-8 w-28 bg-white/5" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-lg bg-[#111113] border border-white/5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 bg-white/5" />
                <Skeleton className="h-7 w-16 bg-white/5" />
              </div>
              <Skeleton className="h-8 w-8 rounded-md bg-white/5" />
            </div>
            <Skeleton className="h-3 w-24 bg-white/5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg bg-[#111113] border border-white/5 p-4 space-y-3">
          <Skeleton className="h-4 w-32 bg-white/5" />
          <Skeleton className="h-48 w-full bg-white/5 rounded" />
        </div>
        <div className="rounded-lg bg-[#111113] border border-white/5 p-4 space-y-3">
          <Skeleton className="h-4 w-28 bg-white/5" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3 w-32 bg-white/5" />
                <Skeleton className="h-2 w-20 bg-white/5" />
              </div>
              <Skeleton className="h-3 w-8 bg-white/5" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, j) => (
          <div key={j} className="rounded-lg bg-[#111113] border border-white/5">
            <div className="px-4 py-3 border-b border-white/5">
              <Skeleton className="h-4 w-28 bg-white/5" />
            </div>
            <div className="divide-y divide-white/5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-5 w-5 rounded-full bg-white/5 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-48 bg-white/5" />
                    <Skeleton className="h-2 w-32 bg-white/5" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full bg-white/5" />
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
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24 bg-white/5" />
          <Skeleton className="h-4 w-48 bg-white/5" />
        </div>
        <Skeleton className="h-8 w-32 bg-white/5 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-64 bg-white/5 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-[#111113] border border-white/5 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32 bg-white/5" />
                <Skeleton className="h-3 w-48 bg-white/5" />
              </div>
              <Skeleton className="h-6 w-6 rounded bg-white/5" />
            </div>
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-white/5" />
                <Skeleton className="h-3 w-12 bg-white/5" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24 bg-white/5" />
                <Skeleton className="h-3 w-16 bg-white/5" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 w-full bg-white/5 rounded" />
              <Skeleton className="h-7 w-7 bg-white/5 rounded" />
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
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28 bg-white/5" />
          <Skeleton className="h-4 w-44 bg-white/5" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 bg-white/5" />
          <Skeleton className="h-8 w-28 bg-white/5" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-64 bg-white/5 rounded-lg" />
        <Skeleton className="h-8 w-32 bg-white/5 rounded-lg" />
      </div>
      <div className="rounded-lg bg-[#111113] border border-white/5">
        <div className="px-4 py-3 border-b border-white/5 flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16 bg-white/5" />
          ))}
        </div>
        <div className="divide-y divide-white/5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-5 w-5 rounded-full bg-white/5 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-56 bg-white/5" />
                <Skeleton className="h-2.5 w-36 bg-white/5" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full bg-white/5" />
              <Skeleton className="h-4 w-12 bg-white/5" />
              <Skeleton className="h-4 w-20 bg-white/5" />
              <Skeleton className="h-4 w-4 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
