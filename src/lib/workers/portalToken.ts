const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidPortalToken(token: string | undefined | null): boolean {
  if (!token?.trim()) return false
  return UUID_REGEX.test(token.trim())
}

export function assertValidPortalToken(token: string): void {
  if (!isValidPortalToken(token)) {
    throw new Error('Neplatný formát odkazu')
  }
}
