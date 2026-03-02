"use client"

import { XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <div className="p-3 rounded-full bg-red-500/10">
        <XCircle className="w-6 h-6 text-red-400" />
      </div>
      <p className="text-[var(--text-secondary)] text-sm">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Reintentar
      </Button>
    </div>
  )
}
