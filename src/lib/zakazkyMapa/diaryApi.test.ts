import { describe, expect, it } from 'vitest'
import { fetchProjectDiaryPage, PROJECT_DIARY_PAGE_SIZE } from '@/lib/zakazkyMapa/diaryApi'

describe('fetchProjectDiaryPage', () => {
  it('vrátí prázdný výsledek pro prázdné orderId', async () => {
    const result = await fetchProjectDiaryPage('', 1)
    expect(result).toEqual({
      entries: [],
      total: 0,
      page: 1,
      pageSize: PROJECT_DIARY_PAGE_SIZE,
      hasMore: false,
    })
  })
})

describe('PROJECT_DIARY_PAGE_SIZE', () => {
  it('je nastaveno na 20 záznamů', () => {
    expect(PROJECT_DIARY_PAGE_SIZE).toBe(20)
  })
})
