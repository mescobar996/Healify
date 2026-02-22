import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Page Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32 bg-zinc-800" />
          <Skeleton className="h-4 w-48 bg-zinc-800" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 bg-zinc-800" />
          <Skeleton className="h-9 w-32 bg-zinc-800" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-lg glass-elite">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16 bg-zinc-800" />
                <Skeleton className="h-7 w-12 bg-zinc-800" />
              </div>
              <Skeleton className="h-8 w-8 rounded-md bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-10 flex-1 bg-zinc-800" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-20 bg-zinc-800" />
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-lg glass-elite">
        {/* Table Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-20 bg-zinc-800" />
            <Skeleton className="h-5 w-8 rounded bg-zinc-800" />
          </div>
          <Skeleton className="h-4 w-20 bg-zinc-800" />
        </div>

        {/* Column Headers */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 border-b border-zinc-800">
          <Skeleton className="h-3 col-span-3 bg-zinc-800" />
          <Skeleton className="h-3 col-span-2 bg-zinc-800" />
          <Skeleton className="h-3 col-span-1 bg-zinc-800" />
          <Skeleton className="h-3 col-span-1 bg-zinc-800" />
          <Skeleton className="h-3 col-span-1 bg-zinc-800" />
          <Skeleton className="h-3 col-span-1 bg-zinc-800" />
          <Skeleton className="h-3 col-span-1 bg-zinc-800" />
          <Skeleton className="h-3 col-span-1 bg-zinc-800" />
          <Skeleton className="h-3 col-span-1 bg-zinc-800" />
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-zinc-800">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="hidden md:grid grid-cols-12 gap-4 px-4 py-3">
              <div className="col-span-3 flex items-center gap-3">
                <Skeleton className="h-4 w-4 bg-zinc-800" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-3/4 bg-zinc-800" />
                  <Skeleton className="h-3 w-1/2 bg-zinc-800" />
                </div>
              </div>
              <div className="col-span-2 flex items-center">
                <Skeleton className="h-4 w-full bg-zinc-800" />
              </div>
              <div className="col-span-1 flex items-center">
                <Skeleton className="h-5 w-16 rounded-full bg-zinc-800" />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <Skeleton className="h-4 w-8 bg-zinc-800" />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <Skeleton className="h-4 w-8 bg-zinc-800" />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <Skeleton className="h-4 w-8 bg-zinc-800" />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <Skeleton className="h-4 w-8 bg-zinc-800" />
              </div>
              <div className="col-span-1 flex items-center">
                <Skeleton className="h-5 w-16 rounded bg-zinc-800" />
              </div>
              <div className="col-span-1 flex items-center">
                <Skeleton className="h-3 w-16 bg-zinc-800" />
              </div>
            </div>
          ))}

          {/* Mobile Rows */}
          <div className="md:hidden divide-y divide-zinc-800">
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 bg-zinc-800" />
                    <Skeleton className="h-4 w-32 bg-zinc-800" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full bg-zinc-800" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20 bg-zinc-800" />
                  <Skeleton className="h-3 w-16 bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}