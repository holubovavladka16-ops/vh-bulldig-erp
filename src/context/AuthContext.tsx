import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { translateAuthError } from '@/lib/auth/errors'
import { notifyLoginSuccess } from '@/lib/auth/loginNotification'
import { supabase, getSupabaseConfigHint, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  profileError: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const PROFILE_RETRY_ATTEMPTS = 3
const PROFILE_RETRY_DELAY_MS = 400

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const initDone = useRef(false)

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) {
      console.error('Chyba načítání profilu:', error.message)
      return null
    }
    return data as Profile
  }, [])

  const fetchProfileWithRetry = useCallback(
    async (userId: string): Promise<Profile | null> => {
      for (let attempt = 0; attempt < PROFILE_RETRY_ATTEMPTS; attempt++) {
        const result = await fetchProfile(userId)
        if (result) return result
        if (attempt < PROFILE_RETRY_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_DELAY_MS * (attempt + 1)))
        }
      }
      return null
    },
    [fetchProfile]
  )

  const loadUserProfile = useCallback(
    async (userId: string) => {
      const userProfile = await fetchProfileWithRetry(userId)
      setProfile(userProfile)
      setProfileError(
        userProfile
          ? null
          : 'Profil administrátora se nepodařilo načíst. Zkuste obnovit stránku nebo se odhlaste a přihlaste znovu.'
      )
      return userProfile
    },
    [fetchProfileWithRetry]
  )

  useEffect(() => {
    let mounted = true

    async function initSession() {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession()

      if (!mounted) return
      if (error) {
        console.error('Chyba načtení relace:', error.message)
      }

      setSession(currentSession)
      setUser(currentSession?.user ?? null)

      if (currentSession?.user) {
        await loadUserProfile(currentSession.user.id)
      } else {
        setProfile(null)
        setProfileError(null)
      }

      if (mounted) {
        initDone.current = true
        setLoading(false)
      }
    }

    void initSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user) {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          await loadUserProfile(newSession.user.id)
        }
      } else {
        setProfile(null)
        setProfileError(null)
      }

      if (initDone.current) {
        setLoading(false)
      }
    })

    const refreshOnVisible = () => {
      if (document.visibilityState !== 'visible') return
      void supabase.auth.getSession().then(({ data: { session: visibleSession } }) => {
        if (!visibleSession) return
        setSession(visibleSession)
        setUser(visibleSession.user)
      })
    }

    document.addEventListener('visibilitychange', refreshOnVisible)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', refreshOnVisible)
    }
  }, [loadUserProfile])

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured()) {
      return {
        error: `Supabase není nakonfigurován. ${getSupabaseConfigHint()}`,
      }
    }

    setProfileError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        return { error: translateAuthError(error.message) }
      }
      if (!data.user) {
        return { error: 'Přihlášení se nezdařilo – chybí uživatel v odpovědi.' }
      }

      const userProfile = await fetchProfileWithRetry(data.user.id)
      if (!userProfile) {
        await supabase.auth.signOut()
        return {
          error:
            'Přihlášení proběhlo, ale profil v databázi chybí nebo není dostupný. Spusťte npm run setup-complete nebo kontaktujte administrátora.',
        }
      }

      setProfile(userProfile)
      setUser(data.user)
      setSession(data.session)
      void notifyLoginSuccess({
        user: data.user,
        profile: userProfile,
        session: data.session,
      })
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Přihlášení se nezdařilo'
      return { error: translateAuthError(message) }
    }
  }

  async function refreshProfile() {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()
    if (!currentSession?.user) return
    await loadUserProfile(currentSession.user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setProfileError(null)
    setSession(null)
    setUser(null)
  }

  async function resetPasswordForEmail(email: string) {
    if (!isSupabaseConfigured()) {
      return { error: `Supabase není nakonfigurován. ${getSupabaseConfigHint()}` }
    }

    const redirectTo = `${window.location.origin}/obnova-hesla`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) {
      return { error: translateAuthError(error.message) }
    }
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        profileError,
        signIn,
        signOut,
        refreshProfile,
        resetPasswordForEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth musí být použit uvnitř AuthProvider')
  }
  return context
}
