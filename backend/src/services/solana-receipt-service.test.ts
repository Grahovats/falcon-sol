import { Prisma } from '@prisma/client'
import bs58 from 'bs58'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { USDC_MINT, MAINNET_GENESIS_HASH, getTreasuryBalance, verifyTransfer } from './solana-receipt-service.js'
const sender = bs58.encode(new Uint8Array(32).fill(1)); const recipient = bs58.encode(new Uint8Array(32).fill(2)); const signature = bs58.encode(new Uint8Array(64).fill(3))
const balance = (owner: string, amount: string, mint = USDC_MINT) => ({ owner, mint, uiTokenAmount: { amount, decimals: 6 } })
const receipt = () => ({ slot: 100, blockTime: 1791806400, meta: { err: null, preTokenBalances: [balance(sender, '150000000')], postTokenBalances: [balance(sender, '0'), balance(recipient, '150000000')] } })
const respond = (result: unknown) => vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, options) => ({ ok: true, json: async () => ({ result: JSON.parse(String(options.body)).method === 'getGenesisHash' ? MAINNET_GENESIS_HASH : result }) })))
afterEach(() => vi.unstubAllGlobals())
describe('finalized USDC receipts', () => {
  it('checks a precise owner-to-owner transfer with finalized commitment', async () => {
    respond(receipt()); expect((await verifyTransfer(signature, sender, recipient, new Prisma.Decimal(150))).slot).toBe(100n)
    const call = vi.mocked(fetch).mock.calls[1]; expect(JSON.parse(String(call?.[1]?.body)).params[1].commitment).toBe('finalized')
  })
  it('rejects an RPC connected to another cluster', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: 'devnet' }) })); await expect(verifyTransfer(signature, sender, recipient, new Prisma.Decimal(150))).rejects.toThrow('mainnet') })
  it('rejects failed transactions', async () => { const tx = receipt(); Object.assign(tx.meta, { err: { InstructionError: [0, 'failure'] } }); respond(tx); await expect(verifyTransfer(signature, sender, recipient, new Prisma.Decimal(150))).rejects.toThrow('successful finalized') })
  it('rejects counterfeit tokens, the wrong recipient, and incorrect amounts', async () => {
    const tx = receipt(); tx.meta.postTokenBalances = [balance(sender, '0'), balance(recipient, '150000000', 'counterfeit')]; respond(tx); await expect(verifyTransfer(signature, sender, recipient, new Prisma.Decimal(150))).rejects.toThrow('exact USDC')
    respond(receipt()); await expect(verifyTransfer(signature, sender, recipient, new Prisma.Decimal(149))).rejects.toThrow('exact USDC')
    await expect(verifyTransfer(signature, recipient, sender, new Prisma.Decimal(150))).rejects.toThrow('exact USDC')
  })
  it('fails closed during RPC failure', async () => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline'))); await expect(verifyTransfer(signature, sender, recipient, new Prisma.Decimal(150))).rejects.toThrow('could not be verified') })
  it('sums only genuine USDC accounts at six decimals', async () => {
    respond({ value: ['100000000', '50000000'].map(amount => ({ account: { data: { parsed: { info: { mint: USDC_MINT, tokenAmount: { amount, decimals: 6 } } } } } })) }); expect((await getTreasuryBalance(recipient)).toString()).toBe('150')
  })
})
