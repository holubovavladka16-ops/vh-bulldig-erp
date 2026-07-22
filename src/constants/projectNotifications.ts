export const PROJECT_NOTIFICATION_TYPE_MISSING_DIARY = 'missing_diary' as const

export type ProjectNotificationType = typeof PROJECT_NOTIFICATION_TYPE_MISSING_DIARY

export const PROJECT_NOTIFICATION_TYPE_LABELS: Record<ProjectNotificationType, string> = {
  missing_diary: 'Chybí stavební deník',
}

export const PROJECT_MARKER_MISSING_DIARY_LABEL = 'Chybí stavební deník'

/** Ruční stavy pozastavující automatickou kontrolu deníku (barva + manual). */
export const DIARY_CHECK_PAUSED_MANUAL_COLORS = ['red', 'orange', 'blue'] as const
