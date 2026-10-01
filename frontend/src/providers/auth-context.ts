import { createContext, useContext } from 'react'
import type { AuthUser } from '../api/auth'

export type AuthStatus = 'loading' | 'anonymous' | 'signing' | 'authenticated' | 'error'
export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
