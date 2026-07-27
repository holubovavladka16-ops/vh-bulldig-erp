import { Textarea } from '@/components/ui/Textarea'

interface DayNotesSectionProps {
  value: string
  onChange: (value: string) => void
}

/** Poznámky ke dni – zatím pouze připravené textové pole bez ukládání do databáze. */
export function DayNotesSection({ value, onChange }: DayNotesSectionProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Poznámka ke dni…"
      hint="Poznámka se zatím neukládá do databáze, jde jen o připravené pole."
    />
  )
}
