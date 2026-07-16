import type { CompanySettings } from '@/types'

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface PdfWatermarkConfig {
  url: string
  opacityPercent: number
  /** Šířka vodoznaku v % šířky tiskové stránky (A4). */
  sizePercent: number
  blurPx: number
}

export const DEFAULT_WATERMARK_OPACITY = 7
/** Výchozí velikost: 65 % šířky stránky. */
export const DEFAULT_WATERMARK_SIZE_PERCENT = 65
/** @deprecated Používejte DEFAULT_WATERMARK_SIZE_PERCENT – sloupec DB zůstává watermark_size_mm. */
export const DEFAULT_WATERMARK_SIZE_MM = DEFAULT_WATERMARK_SIZE_PERCENT
export const DEFAULT_WATERMARK_BLUR_PX = 0

export const WATERMARK_SIZE_PERCENT_MIN = 20
export const WATERMARK_SIZE_PERCENT_MAX = 90

export type WatermarkCompanySource = Pick<
  CompanySettings,
  'watermark_url' | 'watermark_opacity' | 'watermark_size_mm' | 'watermark_blur_px'
> | null | undefined

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function clampFloat(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function opacityPercentToCss(opacityPercent: number): number {
  return clampFloat(opacityPercent / 100, 0, 1)
}

/** Převod uložené hodnoty (dříve mm, nyní %) na procenta šířky stránky. */
export function normalizeWatermarkSizePercent(raw: number | null | undefined): number {
  const value = Number(raw ?? DEFAULT_WATERMARK_SIZE_PERCENT)
  if (!Number.isFinite(value)) return DEFAULT_WATERMARK_SIZE_PERCENT

  // Starší instalace ukládaly mm (typicky 10–120). Převod na % šířky stránky.
  if (value > WATERMARK_SIZE_PERCENT_MAX) {
    return clampInt(Math.round((value / 120) * 85), WATERMARK_SIZE_PERCENT_MIN, WATERMARK_SIZE_PERCENT_MAX)
  }

  return clampInt(value, WATERMARK_SIZE_PERCENT_MIN, WATERMARK_SIZE_PERCENT_MAX)
}

export function extractPdfWatermarkConfig(company: WatermarkCompanySource): PdfWatermarkConfig | null {
  const url = company?.watermark_url?.trim()
  if (!url) return null

  return {
    url,
    opacityPercent: clampInt(company?.watermark_opacity ?? DEFAULT_WATERMARK_OPACITY, 0, 100),
    sizePercent: normalizeWatermarkSizePercent(company?.watermark_size_mm),
    blurPx: clampInt(company?.watermark_blur_px ?? DEFAULT_WATERMARK_BLUR_PX, 0, 20),
  }
}

export function buildWatermarkPrintCss(config: PdfWatermarkConfig | null): string {
  if (!config) {
    return `
  .doc-watermark-layer { display: none !important; }
`
  }

  const opacity = opacityPercentToCss(config.opacityPercent)
  const blur = config.blurPx > 0 ? `filter: blur(${config.blurPx}px);` : ''
  const size = config.sizePercent

  return `
  html, body {
    position: relative;
    min-height: 100%;
  }

  .doc-watermark-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    overflow: hidden;
  }

  .doc-watermark {
    display: block;
    width: ${size}%;
    max-width: ${size}%;
    height: auto;
    max-height: 92%;
    margin: 0;
    object-fit: contain;
    object-position: center center;
    opacity: ${opacity};
    ${blur}
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc-page-content {
    position: relative;
    z-index: 1;
    isolation: isolate;
  }

  .doc-content,
  .doc-shell.doc-content {
    position: relative;
    z-index: 1;
  }

  .doc-header,
  .doc-title-block,
  .doc-section,
  .doc-table,
  .doc-table th,
  .doc-table td,
  .doc-party,
  .doc-sign-box,
  .doc-sign-line,
  .doc-kv,
  .doc-meta-grid,
  .doc-text,
  .doc-photo-block,
  .doc-photo-wrap,
  .doc-footer {
    position: relative;
    z-index: 1;
  }

  @media print {
    .doc-watermark-layer {
      position: fixed;
      inset: 0;
      z-index: 0;
    }

    .doc-watermark {
      width: ${size}% !important;
      max-width: ${size}% !important;
      height: auto !important;
      max-height: 92% !important;
      opacity: ${opacity} !important;
      ${blur}
    }

    .doc-page-content {
      position: relative;
      z-index: 1;
    }
  }
`
}

export function buildDocumentWatermarkHtml(config: PdfWatermarkConfig | null): string {
  if (!config) return ''
  return `<div class="doc-watermark-layer" aria-hidden="true"><img src="${escHtml(config.url)}" alt="" class="doc-watermark" /></div>`
}

export function buildWatermarkPreviewSampleBody(): string {
  return `
    <section class="doc-section">
      <h2>Ukázková tabulka</h2>
      <table class="doc-table">
        <thead>
          <tr><th>Položka</th><th class="num">Množství</th><th class="num">Cena</th></tr>
        </thead>
        <tbody>
          <tr><td>Výkopové práce</td><td class="num">12 h</td><td class="num">4 800 Kč</td></tr>
          <tr><td>Doprava materiálu</td><td class="num">1 ks</td><td class="num">1 200 Kč</td></tr>
          <tr><td>Obsluha stroje</td><td class="num">8 h</td><td class="num">6 400 Kč</td></tr>
        </tbody>
      </table>
    </section>
    <section class="doc-section">
      <h2>Text dokumentu</h2>
      <p class="doc-text">
        Tento náhled ukazuje, jak bude vodoznak vypadat na bílém A4 pozadí. Text a tabulky musí zůstat plně čitelné.
      </p>
    </section>
  `
}
