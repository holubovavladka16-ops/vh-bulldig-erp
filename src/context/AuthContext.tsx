import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Chyba načítání profilu:', error.message)
      return null
    }

    return data as Profile
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)

      if (currentSession?.user) {
        fetchProfile(currentSession.user.id).then(setProfile)
      }

      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user) {
        const userProfile = await fetchProfile(newSession.user.id)
        setProfile(userProfile)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured()) {
      return {
        error:
          'Supabase není nakonfigurován. Vyplňte .env.local a restartujte aplikaci.',
      }
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return { error: translateAuthError(error.message) }
      }
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Přihlášení se nezdařilo'
      return { error: translateAuthError(message) }
    }
  }

  async function refreshProfile() {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (!currentSession?.user) return
    const userProfile = await fetchProfile(currentSession.user.id)
    setProfile(userProfile)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signIn, signOut, refreshProfile }}
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

function translateAuthError(message: string): string {
  const errors: Record<string, string> = {
    'Invalid login credentials': 'Neplatné přihlašovací údaje',
    'Email not confirmed': 'E-mail nebyl potvrzen',
    'User not found': 'Uživatel nenalezen',
    'Too many requests': 'Příliš mnoho pokusů, zkuste to později',
  }

  return errors[message] ?? 'Přihlášení se nezdařilo. Zkuste to znovu.'
}
