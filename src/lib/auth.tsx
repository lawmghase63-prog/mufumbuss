import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from './supabase'
import type { Profile, Role, UserWithProfile } from './types'

interface AuthContextValue {
  user: UserWithProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateProfile: (
    updates: Partial<Pick<Profile, 'full_name'>>,
  ) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUser({ id: session.user.id, email: session.user.email ?? '', profile })
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            profile,
          })
        } else {
          setUser(null)
        }
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  async function updateProfile(
    updates: Partial<Pick<Profile, 'full_name'>>,
  ) {
    if (!user?.id) return { error: 'Not signed in' }
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
    if (error) return { error: error.message }
    const profile = await fetchProfile(user.id)
    setUser((prev) => (prev ? { ...prev, profile } : prev))
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signOut, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export function hasRole(user: UserWithProfile | null, roles: Role[]): boolean {
  return !!user?.profile && roles.includes(user.profile.role)
}
