import { SolanaSignMessage, type SolanaSignMessageFeature } from '@solana/wallet-standard-features'
import { getWallets } from '@wallet-standard/app'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import { StandardConnect, StandardDisconnect, StandardEvents, type StandardConnectFeature, type StandardDisconnectFeature, type StandardEventsFeature } from '@wallet-standard/features'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { WalletContext, useWallet } from './wallet-context'

const walletRegistry = getWallets()
const selectedWalletKey = 'falcon:selected-wallet'

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<readonly Wallet[]>(() => compatibleWallets(walletRegistry.get()))
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const autoConnectAttempted = useRef(false)

  useEffect(() => {
    const update = () => setWallets(compatibleWallets(walletRegistry.get()))
    const offRegister = walletRegistry.on('register', update)
    const offUnregister = walletRegistry.on('unregister', update)
    update()
    return () => { offRegister(); offUnregister() }
  }, [])

  const connect = useCallback(async (nextWallet: Wallet, silent = false) => {
    setConnecting(true)
    setError(null)
    try {
      const feature = nextWallet.features[StandardConnect] as StandardConnectFeature[typeof StandardConnect]
      const result = await feature.connect({ silent })
      const nextAccount = result.accounts.find(supportsMessageSigning)
      if (!nextAccount) throw new Error('This wallet did not provide a Solana account that can sign messages.')
      setWallet(nextWallet)
      setAccount(nextAccount)
      localStorage.setItem(selectedWalletKey, nextWallet.name)
      setModalOpen(false)
    } catch (cause: unknown) {
      const message = cause instanceof Error && /reject|cancel/i.test(cause.message) ? 'Wallet connection cancelled.' : cause instanceof Error ? cause.message : 'Wallet connection failed.'
      setError(message)
      if (!silent) throw cause
    } finally {
      setConnecting(false)
    }
  }, [])

  useEffect(() => {
    if (autoConnectAttempted.current || wallets.length === 0) return
    autoConnectAttempted.current = true
    const savedName = localStorage.getItem(selectedWalletKey)
    const savedWallet = wallets.find((candidate) => candidate.name === savedName)
    if (!savedWallet) return
    const timer = window.setTimeout(() => void connect(savedWallet, true), 0)
    return () => window.clearTimeout(timer)
  }, [connect, wallets])

  useEffect(() => {
    if (!wallet || !(StandardEvents in wallet.features)) return
    const feature = wallet.features[StandardEvents] as StandardEventsFeature[typeof StandardEvents]
    return feature.on('change', ({ accounts }) => {
      if (!accounts) return
      const nextAccount = accounts.find(supportsMessageSigning) ?? null
      setAccount(nextAccount)
      if (!nextAccount) setWallet(null)
    })
  }, [wallet])

  const disconnect = useCallback(async () => {
    const currentWallet = wallet
    setWallet(null)
    setAccount(null)
    setError(null)
    localStorage.removeItem(selectedWalletKey)
    if (currentWallet && StandardDisconnect in currentWallet.features) {
      const feature = currentWallet.features[StandardDisconnect] as StandardDisconnectFeature[typeof StandardDisconnect]
      await feature.disconnect()
    }
  }, [wallet])

  const signMessage = useCallback(async (message: Uint8Array) => {
    if (!wallet || !account) throw new Error('Connect a Solana wallet first.')
    const feature = wallet.features[SolanaSignMessage] as SolanaSignMessageFeature[typeof SolanaSignMessage]
    const [result] = await feature.signMessage({ account, message })
    if (!result) throw new Error('The wallet did not return a signature.')
    if (!equalBytes(result.signedMessage, message)) throw new Error('The wallet modified the authentication message, so Falcon could not verify it safely.')
    return result.signature
  }, [account, wallet])

  const value = useMemo(() => ({ wallets, wallet, account, connecting, error, modalOpen, setModalOpen, connect: (nextWallet: Wallet) => connect(nextWallet), disconnect, signMessage }), [wallets, wallet, account, connecting, error, modalOpen, connect, disconnect, signMessage])
  return <WalletContext.Provider value={value}>{children}<WalletModal /></WalletContext.Provider>
}

function WalletModal() {
  const { wallets, modalOpen, setModalOpen, connect, connecting, error } = useWallet()
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (modalOpen && !dialog.open) dialog.showModal()
    if (!modalOpen && dialog.open) dialog.close()
  }, [modalOpen])

  return <dialog ref={dialogRef} onClose={() => setModalOpen(false)} onCancel={() => setModalOpen(false)} aria-labelledby="wallet-modal-title" className="wallet-dialog m-auto w-[min(92vw,30rem)] border border-line bg-surface p-0 text-ink backdrop:bg-black/80">
    <div className="border-b border-line p-5"><p className="font-mono text-xs uppercase tracking-wider text-primary">Operator identity</p><h2 id="wallet-modal-title" className="mt-2 text-xl font-semibold">Connect a Solana wallet</h2><p className="mt-2 text-sm leading-6 text-muted">Choose an installed wallet. Falcon will ask for a separate message signature before creating your session.</p></div>
    <div className="space-y-2 p-3">{wallets.length === 0 ? <div className="p-4 text-sm text-muted"><p>No compatible wallet was detected in this browser.</p><a href="https://solana.com/ecosystem/explore?categories=wallet" target="_blank" rel="noreferrer" className="focus-ring mt-4 inline-flex min-h-10 items-center text-primary">Find a Solana wallet</a></div> : wallets.map((candidate) => <button key={candidate.name} type="button" disabled={connecting} onClick={() => void connect(candidate).catch(() => undefined)} className="focus-ring flex min-h-14 w-full items-center gap-3 border border-line px-4 text-left hover:border-primary hover:bg-primary/5 disabled:cursor-wait disabled:opacity-60"><img src={candidate.icon} alt="" className="size-7" /><span className="font-medium">{candidate.name}</span></button>)}{error && <p className="px-4 py-2 text-sm text-danger" role="alert">{error}</p>}</div>
    <div className="flex justify-end border-t border-line p-3"><button type="button" onClick={() => setModalOpen(false)} className="focus-ring min-h-10 px-4 text-sm text-muted hover:text-ink">Cancel</button></div>
  </dialog>
}

function compatibleWallets(wallets: readonly Wallet[]) {
  return wallets.filter((wallet) => StandardConnect in wallet.features && SolanaSignMessage in wallet.features && wallet.chains.some((chain) => chain.startsWith('solana:')))
}
function supportsMessageSigning(account: WalletAccount) { return account.chains.some((chain) => chain.startsWith('solana:')) && account.features.includes(SolanaSignMessage) }
function equalBytes(left: Uint8Array, right: Uint8Array) { return left.length === right.length && left.every((value, index) => value === right[index]) }
