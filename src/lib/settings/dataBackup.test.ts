import { describe, expect, it } from 'vitest'
import {
  PRESERVED_ENTITIES,
  SAFE_TEST_DATA_TABLES,
  TEST_DATA_CONFIRM_PHRASE,
} from '@/constants/dataBackup'

describe('dataBackup constants', () => {
  it('never includes preserved entities in safe cleanup tables', () => {
    for (const preserved of PRESERVED_ENTITIES) {
      expect(SAFE_TEST_DATA_TABLES).not.toContain(preserved)
    }
  })

  it('requires exact confirmation phrase', () => {
    expect(TEST_DATA_CONFIRM_PHRASE).toBe('VYMAZAT TESTOVACÍ DATA')
    expect('vymazat testovací data').not.toBe(TEST_DATA_CONFIRM_PHRASE)
  })

  it('lists workers only in preserved entities', () => {
    expect(PRESERVED_ENTITIES).toContain('workers')
    expect(SAFE_TEST_DATA_TABLES).not.toContain('workers')
  })
})
