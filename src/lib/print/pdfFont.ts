import type { jsPDF } from 'jspdf'

const FONT_REGULAR_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf'
const FONT_BOLD_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf'

const FONT_FAMILY = 'NotoSans'
let fontsPromise: Promise<void> | null = null

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Načtení PDF fontu se nezdařilo.')
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

export async function ensurePdfFonts(doc: jsPDF): Promise<void> {
  if (fontsPromise) {
    await fontsPromise
    doc.setFont(FONT_FAMILY, 'normal')
    return
  }

  fontsPromise = (async () => {
    const [regular, bold] = await Promise.all([
      fetchFontBase64(FONT_REGULAR_URL),
      fetchFontBase64(FONT_BOLD_URL),
    ])
    doc.addFileToVFS('NotoSans-Regular.ttf', regular)
    doc.addFont('NotoSans-Regular.ttf', FONT_FAMILY, 'normal')
    doc.addFileToVFS('NotoSans-Bold.ttf', bold)
    doc.addFont('NotoSans-Bold.ttf', FONT_FAMILY, 'bold')
  })()

  await fontsPromise
  doc.setFont(FONT_FAMILY, 'normal')
}

export { FONT_FAMILY }
