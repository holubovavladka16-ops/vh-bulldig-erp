import type { Session, User } from '@supabase/supabase-js'
import { parseClientLoginInfo } from '@/lib/auth/clientInfo'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface NotifyLoginParams {
  user: User
  profile: Profile | null
  session: Session | null
}

/**
 * Po úspěšném přihlášení: zavolá Edge Function (log + e-mail administrátorovi).
 * Chyba neblokuje přihlášení – při selhání se použije záložní DB log.
 */
export async function notifyLoginSuccess({ user, profile, session }: NotifyLoginParams): Promise<void> {
  if (!session?.access_token) return

  const clientInfo = parseClientLoginInfo()
  const userName = profile?.full_name?.trim() || profile?.email || user.email || ''

  try {
    const { error } = await supabase.functions.invoke('notify-login', {
      body: {
        user_email: user.email ?? '',
        user_name: userName,
        ...clientInfo,
      },
    })

    if (error) {
      await insertLoginLogFallback(user, userName, clientInfo, error.message)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Neznámá chyba notifikace'
    console.error('Login notification failed:', message)
    await insertLoginLogFallback(user, userName, clientInfo, message)
  }
}

async function insertLoginLogFallback(
  user: User,
  userName: string,
  clientInfo: ReturnType<typeof parseClientLoginInfo>,
  emailError: string
): Promise<void> {
  try {
    await supabase.rpc('insert_login_log_fallback', {
      p_user_email: user.email ?? '',
      p_user_name: userName,
      p_ip_address: null,
      p_device: clientInfo.device,
      p_browser: clientInfo.browser,
      p_os: clientInfo.os,
      p_location: null,
      p_user_agent: clientInfo.user_agent,
      p_device_type: clientInfo.device_type,
      p_email_error: emailError,
    })
  } catch (fallbackErr) {
    console.error('Login log fallback failed:', fallbackErr)
  }
}
