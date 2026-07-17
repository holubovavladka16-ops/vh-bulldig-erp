import { FORM_CHECK_OUTCOME_LABELS, FORM_CHECK_OUTCOME_STYLES } from '@/constants/formCheck'
import type { CompareOutcome } from '@/types/formCheck'

interface FormCheckOutcomeBadgeProps {
  outcome: CompareOutcome
  className?: string
}

export function FormCheckOutcomeBadge({ outcome, className = '' }: FormCheckOutcomeBadgeProps) {
  const styles = FORM_CHECK_OUTCOME_STYLES[outcome]

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles.bg} ${styles.text} ${styles.border} ${className}`}
    >
      {FORM_CHECK_OUTCOME_LABELS[outcome]}
    </span>
  )
}
