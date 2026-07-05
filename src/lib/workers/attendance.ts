/** Výpočet odpracovaných hodin z časů docházky */
export function calcWorkHours(workStart: string, workEnd: string, breakMinutes: number): number {
  if (!workStart || !workEnd) return 0

  const [sh, sm] = workStart.split(':').map(Number)
  const [eh, em] = workEnd.split(':').map(Number)
  if ([sh, sm, eh, em].some((v) => Number.isNaN(v))) return 0

  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60

  return Math.max(0, Math.round(((minutes - breakMinutes) / 60) * 100) / 100)
}

/** Formát TIME z DB (HH:MM:SS) na HH:MM pro input type="time" */
export function formatTimeForInput(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 5)
}
