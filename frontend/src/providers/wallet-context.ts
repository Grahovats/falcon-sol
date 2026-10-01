import type { Wallet, WalletAccount } from '@wallet-standard/base'
import { createContext, useContext } from 'react'

export interface WalletContextValue {
  wallets: readonly Wallet[]
  wallet: Wallet | null
  account: WalletAccount | null
  connecting: boolean
  error: string | null
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  connect: (wallet: Wallet) => Promise<void>
  disconnect: () => Promise<void>
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
}

export const WalletContext = createContext<WalletContextValue | null>(null)

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet must be used inside WalletProvider')
  return context
}
