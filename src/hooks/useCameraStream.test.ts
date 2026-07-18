import { describe, expect, it } from 'vitest'
import { classifyGetUserMediaError } from './useCameraStream'

describe('classifyGetUserMediaError', () => {
  it('maps NotAllowedError to permission_denied', () => {
    const result = classifyGetUserMediaError(new DOMException('denied', 'NotAllowedError'))
    expect(result.code).toBe('permission_denied')
    expect(result.message).toMatch(/zamítnut/i)
    expect(result.domException).toBe('NotAllowedError')
  })

  it('maps NotFoundError to camera_unavailable', () => {
    const result = classifyGetUserMediaError(new DOMException('none', 'NotFoundError'))
    expect(result.code).toBe('camera_unavailable')
    expect(result.domException).toBe('NotFoundError')
  })

  it('maps NotReadableError to camera_unavailable', () => {
    const result = classifyGetUserMediaError(new DOMException('busy', 'NotReadableError'))
    expect(result.code).toBe('camera_unavailable')
    expect(result.message).toMatch(/obsazená/i)
  })

  it('maps SecurityError to permission_denied', () => {
    const result = classifyGetUserMediaError(new DOMException('https', 'SecurityError'))
    expect(result.code).toBe('permission_denied')
    expect(result.message).toMatch(/HTTPS/i)
  })
})
