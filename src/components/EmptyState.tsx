import React from 'react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description: string
  ctaLabel?: string
  onCtaClick?: () => void
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, onCtaClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Icon className="w-5 h-5 text-[var(--text-tertiary)]" />
      <p className="text-[14px] font-medium text-[var(--text-secondary)]">{title}</p>
      <p className="text-[12px] text-[var(--text-tertiary)] max-w-[280px]">{description}</p>
      {ctaLabel ? (
        <Button variant="secondary" size="sm" onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  )
}
