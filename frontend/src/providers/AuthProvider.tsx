import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createChallenge, getSession, logout as logoutRequest, verifyChallenge, type AuthUser } from '../api/auth'
import { AuthContext, type AuthStatus } from './auth-context'
import { useWallet } from './wallet-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { account, signMessage, disconnect } = useWallet()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const response = await getSession()
      setUser(response.data)
      setStatus(response.data ? 'authenticated' : 'anonymous')
    } catch (cause: unknown) {
      setUser(null)
      setError(cause instanceof Error ? cause.message : 'Could not verify your Falcon session.')
      setStatus('error')
    }
  }, [])

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])

  useEffect(() => {
    if (status !== 'authenticated' || !user?.wallet || !account || user.wallet === account.address) return
    void logoutRequest().finally(() => { setUser(null); setError('Wallet changed. Sign in with the selected wallet.'); setStatus('error') })
  }, [account, status, user?.wallet])

  const signIn = useCallback(async () => {
    if (!account) throw new Error('Connect a Solana wallet first.')
    if (!signMessage) throw new Error('This wallet does not support message signing.')
    setStatus('signing')
    setError(null)
    try {
      const walletAddress = account.address
      const challenge = await createChallenge(walletAddress)
      const signature = await signMessage(new TextEncoder().encode(challenge.data.message))
      const verified = await verifyChallenge(challenge.data.challengeId, walletAddress, signature)
      setUser(verified.data)
      setStatus('authenticated')
    } catch (cause: unknown) {
      const message = cause instanceof Error && /reject|cancel/i.test(cause.message)
        ? 'Signature request cancelled. Your wallet remains connected.'
        : cause instanceof Error ? cause.message : 'Wallet sign-in failed.'
      setUser(null)
      setError(message)
      setStatus('error')
      throw cause
    }
  }, [account, signMessage])

  const signOut = useCallback(async () => {
    try { await logoutRequest() } finally {
      setUser(null)
      setError(null)
      setStatus('anonymous')
      await disconnect().catch(() => undefined)
    }
  }, [disconnect])

  const value = useMemo(() => ({ status, user, error, signIn, signOut, refresh }), [status, user, error, signIn, signOut, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
