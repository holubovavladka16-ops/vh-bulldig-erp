import { getInitialAdminEmailHint } from '@/lib/env'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

export { getInitialAdminEmailHint, isSupabaseConfigured }

export async function checkSystemNeedsBootstrap(): Promise<boolean> {
  const { data, error } = await supabase.rpc('system_needs_bootstrap')
  if (error) {
    if (error.message.includes('system_needs_bootstrap') || error.code === 'PGRST202') {
      throw new Error(
        'Databáze nemá aplikované migrace. Spusťte v projektu: npm run setup-complete (vyžaduje SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN v .env.local).'
      )
    }
    throw new Error(error.message)
  }
  return Boolean(data)
}

export async function bootstrapFirstAdmin(
  email: string,
  password: string,
  fullName: string
): Promise<void> {
  const { error } = await supabase.rpc('bootstrap_first_admin', {
    p_email: email.trim(),
    p_password: password,
    p_full_name: fullName.trim(),
  })
  if (error) throw new Error(error.message)
}

export async function adminCreateUser(input: {
  email: string
  password: string
  fullName: string
  role: UserRole
}): Promise<void> {
  const { error } = await supabase.rpc('admin_create_user', {
    p_email: input.email.trim(),
    p_password: input.password,
    p_full_name: input.fullName.trim(),
    p_role: input.role,
  })
  if (error) throw new Error(error.message)
}

export async function adminSetUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_active', {
    p_user_id: userId,
    p_is_active: isActive,
  })
  if (error) throw new Error(error.message)
}

export async function adminRevokeAdministrator(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_revoke_administrator', {
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
}

export async function updateAuthEmail(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function updateAuthPassword(newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error('Heslo musí mít alespoň 8 znaků')
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(translateAuthError(error.message))
}

export function buildAccessShareEmailUrl(input: {
  recipientEmail: string
  loginUrl: string
  invitedEmail: string
  temporaryPassword?: string
}): string {
  const lines = [
    'Přístup do ERP systému VH Bulldig',
    '',
    `Přihlašovací adresa: ${input.loginUrl}`,
    `E-mail: ${input.invitedEmail}`,
  ]

  if (input.temporaryPassword) {
    lines.push(`Dočasné heslo: ${input.temporaryPassword}`)
    lines.push('', 'Po prvním přihlášení si prosím změňte heslo v Nastavení → Profil administrátora.')
  } else {
    lines.push('', 'Heslo vám sdělí administrátor systému.')
  }

  return `mailto:${encodeURIComponent(input.recipientEmail)}?subject=${encodeURIComponent('Přístup do VH Bulldig ERP')}&body=${encodeURIComponent(lines.join('\n'))}`
}

function translateAuthError(message: string): string {
  const errors: Record<string, string> = {
    'Invalid login credentials': 'Neplatné přihlašovací údaje',
    'Email not confirmed': 'E-mail nebyl potvrzen – zkontrolujte schránku',
    'User not found': 'Uživatel nenalezen',
    'Too many requests': 'Příliš mnoho pokusů, zkuste to později',
    'New email address is not valid': 'Nový e-mail není platný',
    'Password should be at least 6 characters': 'Heslo musí mít alespoň 8 znaků',
    'Unable to validate email address: invalid format': 'Neplatný formát e-mailu',
  }
  return errors[message] ?? message
}
