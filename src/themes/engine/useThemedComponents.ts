import { useTheme } from '@/context/ThemeContext'
import {
  getHeaderComponent,
  getModuleCardComponent,
  getSidebarComponent,
  getStatPanelComponent,
} from '@/themes/engine/registry'

/** Vrátí komponentu levého menu odpovídající aktuálně zvolenému motivu. */
export function useSidebarComponent() {
  const { visualTheme } = useTheme()
  return getSidebarComponent(visualTheme)
}

/** Vrátí komponentu horního panelu odpovídající aktuálně zvolenému motivu. */
export function useHeaderComponent() {
  const { visualTheme } = useTheme()
  return getHeaderComponent(visualTheme)
}

/** Vrátí komponentu karty modulu odpovídající aktuálně zvolenému motivu. */
export function useModuleCardComponent() {
  const { visualTheme } = useTheme()
  return getModuleCardComponent(visualTheme)
}

/** Vrátí komponentu statistického panelu odpovídající aktuálně zvolenému motivu. */
export function useStatPanelComponent() {
  const { visualTheme } = useTheme()
  return getStatPanelComponent(visualTheme)
}
