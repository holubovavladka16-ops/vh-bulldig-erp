import { describe, expect, it } from 'vitest'
import { getOrderStatusBadgeVariant } from '@/constants/orderStatusBadge'

describe('getOrderStatusBadgeVariant', () => {
  it('aktivní stav zakázky nepoužívá zelenou (success) variantu', () => {
    expect(getOrderStatusBadgeVariant('aktivni')).not.toBe('success')
    expect(getOrderStatusBadgeVariant('aktivni')).toBe('info')
  })
})
