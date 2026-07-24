import { describe, expect, it } from 'vitest'
import {
  isApprovedDiaryForMarkerColor,
  MARKER_COLOR_DIARY_STATUSES,
  VALID_DIARY_ENTRY_STATUSES,
} from '@/constants/diaryValidity'

describe('MARKER_COLOR_DIARY_STATUSES', () => {
  it('počítá jen schválené zápisy', () => {
    expect(MARKER_COLOR_DIARY_STATUSES).toEqual(['approved'])
  })

  it('odeslaný zápis nepočítá pro barvu markeru', () => {
    expect(isApprovedDiaryForMarkerColor('submitted')).toBe(false)
    expect(isApprovedDiaryForMarkerColor('pending_review')).toBe(false)
    expect(isApprovedDiaryForMarkerColor('approved')).toBe(true)
  })

  it('validní zápisy pro notifikace zůstávají širší', () => {
    expect(VALID_DIARY_ENTRY_STATUSES).toContain('submitted')
    expect(VALID_DIARY_ENTRY_STATUSES).toContain('pending_review')
  })
})
