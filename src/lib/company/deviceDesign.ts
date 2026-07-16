import { normalizeAppDesign, VALID_APP_DESIGNS } from '@/constants/appDesign'
import type { AppDesign } from '@/types'

export const DEVICE_DESIGN_STORAGE_KEY = 'vh_bulldig_device_design'

export function getStoredDeviceDesign(): AppDesign | null {
  try {
    const raw = localStorage.getItem(DEVICE_DESIGN_STORAGE_KEY)
    if (!raw) return null
    if (!VALID_APP_DESIGNS.has(raw as AppDesign)) {
      localStorage.removeItem(DEVICE_DESIGN_STORAGE_KEY)
      return null
    }
    return normalizeAppDesign(raw)
  } catch {
    return null
  }
}

export function hasStoredDeviceDesign(): boolean {
  return getStoredDeviceDesign() !== null
}

export function setStoredDeviceDesign(design: AppDesign): void {
  localStorage.setItem(DEVICE_DESIGN_STORAGE_KEY, normalizeAppDesign(design))
}

export function clearStoredDeviceDesign(): void {
  localStorage.removeItem(DEVICE_DESIGN_STORAGE_KEY)
}

export function resolveActiveAppDesign(companyDefault: AppDesign | null | undefined): AppDesign {
  return getStoredDeviceDesign() ?? normalizeAppDesign(companyDefault)
}
