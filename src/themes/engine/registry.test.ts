import { describe, expect, it } from 'vitest'
import { getHeaderComponent, getModuleCardComponent, getSidebarComponent, getStatPanelComponent } from '@/themes/engine/registry'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { CrystalDiscSidebar } from '@/themes/components/sidebar/CrystalDiscSidebar'
import { CrystalDiscHeader } from '@/themes/components/header/CrystalDiscHeader'
import { DefaultModuleCard } from '@/themes/components/moduleCard/DefaultModuleCard'
import { CrystalDiscModuleCard } from '@/themes/components/moduleCard/CrystalDiscModuleCard'
import { DefaultStatPanel } from '@/themes/components/statPanel/DefaultStatPanel'
import { CrystalDiscStatPanel } from '@/themes/components/statPanel/CrystalDiscStatPanel'

describe('Theme Engine – registr komponent', () => {
  it('vrátí registrovaný sidebar pro Variantu 14', () => {
    expect(getSidebarComponent('executive-crystal-disc')).toBe(CrystalDiscSidebar)
  })

  it('vrátí výchozí sidebar pro motiv bez vlastní registrace', () => {
    expect(getSidebarComponent('neon-glass')).toBe(Sidebar)
    expect(getSidebarComponent('signature-elite')).toBe(Sidebar)
  })

  it('vrátí registrovaný header pro Variantu 14', () => {
    expect(getHeaderComponent('executive-crystal-disc')).toBe(CrystalDiscHeader)
  })

  it('vrátí výchozí header pro motiv bez vlastní registrace', () => {
    expect(getHeaderComponent('black-gold')).toBe(Header)
  })

  it('vrátí registrovanou komponentu karty modulu pro Variantu 14', () => {
    expect(getModuleCardComponent('executive-crystal-disc')).toBe(CrystalDiscModuleCard)
  })

  it('vrátí výchozí kartu modulu pro motiv bez vlastní registrace', () => {
    expect(getModuleCardComponent('neon-glass')).toBe(DefaultModuleCard)
    expect(getModuleCardComponent('design-2')).toBe(DefaultModuleCard)
    expect(getModuleCardComponent('signature-elite')).toBe(DefaultModuleCard)
  })

  it('vrátí registrovaný statistický panel pro Variantu 14', () => {
    expect(getStatPanelComponent('executive-crystal-disc')).toBe(CrystalDiscStatPanel)
  })

  it('vrátí výchozí statistický panel pro motiv bez vlastní registrace', () => {
    expect(getStatPanelComponent('black-gold')).toBe(DefaultStatPanel)
  })
})
