import type { ComponentType } from 'react'
import type { VisualThemeId } from '@/constants/visualThemes'
import type { HeaderProps, ModuleCardProps, SidebarProps, StatPanelProps } from '@/themes/engine/types'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { CrystalDiscSidebar } from '@/themes/components/sidebar/CrystalDiscSidebar'
import { CrystalDiscHeader } from '@/themes/components/header/CrystalDiscHeader'
import { DefaultModuleCard } from '@/themes/components/moduleCard/DefaultModuleCard'
import { CrystalDiscModuleCard } from '@/themes/components/moduleCard/CrystalDiscModuleCard'
import { DefaultStatPanel } from '@/themes/components/statPanel/DefaultStatPanel'
import { CrystalDiscStatPanel } from '@/themes/components/statPanel/CrystalDiscStatPanel'

/**
 * Theme Engine – centrální registr.
 *
 * Každý záznam je VOLITELNÝ. Motiv, který zde nemá vlastní komponentu,
 * automaticky použije výchozí (`Sidebar`, `Header`, `Default*`) – tedy
 * přesně dnešní vzhled. To znamená, že přidání nové varianty do tohoto
 * registru je vždy čistě aditivní a nemůže poškodit ostatní motivy.
 *
 * Postup přidání nové varianty do enginu (pro budoucí variantu X):
 *   1. Vytvořit `src/themes/components/moduleCard/XModuleCard.tsx` (a
 *      obdobně pro statPanel/sidebar/header dle potřeby),
 *      se stejným props kontraktem jako v `themes/engine/types.ts`.
 *   2. Zaregistrovat ji zde pod id varianty.
 *   3. Nic jiného se měnit nemusí – stránky (Dashboard, AppLayout) čtou
 *      komponentu přes `getXComponent()`/`useXComponent()`.
 */
export const SIDEBAR_REGISTRY: Partial<Record<VisualThemeId, ComponentType<SidebarProps>>> = {
  'executive-crystal-disc': CrystalDiscSidebar,
}

export const HEADER_REGISTRY: Partial<Record<VisualThemeId, ComponentType<HeaderProps>>> = {
  'executive-crystal-disc': CrystalDiscHeader,
}

export const MODULE_CARD_REGISTRY: Partial<Record<VisualThemeId, ComponentType<ModuleCardProps>>> = {
  'executive-crystal-disc': CrystalDiscModuleCard,
}

export const STAT_PANEL_REGISTRY: Partial<Record<VisualThemeId, ComponentType<StatPanelProps>>> = {
  'executive-crystal-disc': CrystalDiscStatPanel,
}

export function getSidebarComponent(themeId: VisualThemeId): ComponentType<SidebarProps> {
  return SIDEBAR_REGISTRY[themeId] ?? Sidebar
}

export function getHeaderComponent(themeId: VisualThemeId): ComponentType<HeaderProps> {
  return HEADER_REGISTRY[themeId] ?? Header
}

export function getModuleCardComponent(themeId: VisualThemeId): ComponentType<ModuleCardProps> {
  return MODULE_CARD_REGISTRY[themeId] ?? DefaultModuleCard
}

export function getStatPanelComponent(themeId: VisualThemeId): ComponentType<StatPanelProps> {
  return STAT_PANEL_REGISTRY[themeId] ?? DefaultStatPanel
}
