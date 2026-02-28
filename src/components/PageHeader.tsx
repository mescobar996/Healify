import React from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/80 backdrop-blur-sm">
      <div>
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h1>
        {description ? (
          <p className="text-[12px] text-[var(--text-tertiary)]">{description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  )
}
