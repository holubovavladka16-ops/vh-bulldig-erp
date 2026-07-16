const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Neplatné přihlašovací údaje',
  'Email not confirmed': 'E-mail nebyl potvrzen – zkontrolujte schránku',
  'User not found': 'Uživatel nenalezen',
  'Too many requests': 'Příliš mnoho pokusů, zkuste to později',
  'New email address is not valid': 'Nový e-mail není platný',
  'Password should be at least 6 characters': 'Heslo musí mít alespoň 8 znaků',
  'Unable to validate email address: invalid format': 'Neplatný formát e-mailu',
  'Auth session missing!': 'Relace vypršela – přihlaste se znovu',
  'JWT expired': 'Relace vypršela – přihlaste se znovu',
}

export function translateAuthError(message: string): string {
  return AUTH_ERRORS[message] ?? message
}

export function isSessionExpiredError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('jwt expired') || normalized.includes('session missing')
}
