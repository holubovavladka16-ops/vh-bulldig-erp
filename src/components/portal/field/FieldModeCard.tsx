import type { ReactNode } from 'react'

interface FieldModeCardProps {
  title: string
  icon?: string
  children: ReactNode
  className?: string
}

export function FieldModeCard({ title, icon, children, className = '' }: FieldModeCardProps) {
  return (
    <section className={`field-mode-card ${className}`}>
      <h2 className="field-mode-card__title">
        {icon && <span className="field-mode-card__title-icon" aria-hidden="true">{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  )
}
