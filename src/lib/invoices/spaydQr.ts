/** SPAYD řetězec pro QR platbu (Short Payment Descriptor) */

export interface SpaydInput {
  account: string
  amount: number
  variableSymbol: string
  message?: string
  currency?: string
}

function sanitizeSpaydValue(value: string): string {
  return value.replace(/\*/g, '%2A').trim()
}

/** Převod českého formátu účtu na IBAN pro SPAYD */
export function formatAccountForSpayd(rawAccount: string): string | null {
  const trimmed = rawAccount.replace(/\s/g, '')
  if (!trimmed) return null

  if (/^CZ\d{22,24}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  const slashMatch = trimmed.match(/^(\d+)\/(\d{4})$/)
  if (slashMatch) {
    const accountNumber = slashMatch[1].padStart(16, '0')
    const bankCode = slashMatch[2]
    const bban = `${bankCode}${accountNumber}`
    const rearranged = `${bban}CZ00`
    const digits = rearranged.replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55))
    let checksum = 98 - (Number(BigInt(digits) % 97n))
    if (checksum < 10) checksum = Number(`0${checksum}`)
    return `CZ${checksum}${bankCode}${accountNumber}`
  }

  return trimmed.toUpperCase()
}

export function buildSpaydString(input: SpaydInput): string | null {
  const account = formatAccountForSpayd(input.account)
  if (!account) return null

  const parts = [
    'SPD*1.0',
    `ACC:${account}`,
    `AM:${input.amount.toFixed(2)}`,
    `CC:${input.currency ?? 'CZK'}`,
  ]

  const vs = input.variableSymbol.replace(/\D/g, '')
  if (vs) parts.push(`X-VS:${vs}`)

  const message = input.message?.trim()
  if (message) parts.push(`MSG:${sanitizeSpaydValue(message.slice(0, 60))}`)

  return parts.join('*')
}

export function buildQrPaymentUrl(spayd: string, size = 180): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(spayd)}&bgcolor=ffffff&color=000000&margin=8`
}
