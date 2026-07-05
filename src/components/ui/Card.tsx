import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
  neon?: boolean
}

export function Card({ children, className = '', padding = true, neon = true }: CardProps) {
  return (
    <div
      className={`
        glass-panel rounded-2xl
        ${neon ? 'neon-border' : ''}
        ${padding ? 'p-6' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-theme-primary">{title}</h3>
        {description && <p className="mt-1 text-sm text-theme-secondary">{description}</p>}
      </div>
      {action}
    </div>
  )
}
