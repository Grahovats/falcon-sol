import bs58 from 'bs58'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { env } from '../config/env.js'
import { AppError } from '../errors/app-error.js'

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const balanceSchema = z.object({ mint: z.string(), owner: z.string().optional(), uiTokenAmount: z.object({ amount: z.string().regex(/^\d+$/), decimals: z.number() }) })
const transactionSchema = z.object({ slot: z.number().int(), blockTime: z.number().nullable(), meta: z.object({ err: z.unknown(), preTokenBalances: z.array(balanceSchema), postTokenBalances: z.array(balanceSchema) }) })

async function rpc(method: string, params: unknown[]) {
  try {
    const response = await fetch(env.SOLANA_RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12_000) })
    if (!response.ok) throw new Error('RPC unavailable')
    const body = z.object({ result: z.unknown().optional(), error: z.unknown().optional() }).parse(await response.json())
    if (body.error || body.result == null) throw new Error('Receipt unavailable')
    return body.result
  } catch { throw new AppError('RECEIPT_UNAVAILABLE', 'The finalized Solana receipt could not be verified. Try again; no funding or payment record was changed.', 503) }
}

export function tokenDelta(transaction: z.infer<typeof transactionSchema>, wallet: string) {
  const total = (balances: z.infer<typeof balanceSchema>[]) => balances.filter(b => b.owner === wallet && b.mint === USDC_MINT && b.uiTokenAmount.decimals === 6).reduce((sum, b) => sum + BigInt(b.uiTokenAmount.amount), 0n)
  return total(transaction.meta.postTokenBalances) - total(transaction.meta.preTokenBalances)
}

// Full mainnet genesis hash: https://solana.com/docs/payments/agentic-payments/x402
export const MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
async function assertMainnet() {
  if (await rpc('getGenesisHash', []) !== MAINNET_GENESIS_HASH) throw new AppError('INVALID_RECEIPT', 'The configured RPC must connect to Solana mainnet.')
}

export async function verifyTransfer(signature: string, sender: string, recipient: string, amount: Prisma.Decimal) {
  try { if (bs58.decode(signature).length !== 64 || bs58.decode(sender).length !== 32 || bs58.decode(recipient).length !== 32) throw new Error() }
  catch { throw new AppError('INVALID_RECEIPT', 'Enter a valid Solana transaction signature and wallet addresses.') }
  await assertMainnet()
  const parsed = transactionSchema.safeParse(await rpc('getTransaction', [signature, { commitment: 'finalized', encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]))
  if (!parsed.success || parsed.data.meta.err !== null || parsed.data.blockTime === null) throw new AppError('INVALID_RECEIPT', 'A successful finalized transaction with token balances and a block timestamp is required.')
  const units = BigInt(amount.mul(1e6).toFixed(0))
  if (amount.decimalPlaces() > 6 || units <= 0n || sender === recipient || tokenDelta(parsed.data, sender) !== -units || tokenDelta(parsed.data, recipient) !== units) throw new AppError('RECEIPT_MISMATCH', 'The receipt must transfer the exact USDC amount from the recorded sender to the recorded recipient.')
  return { slot: BigInt(parsed.data.slot), receivedAt: new Date(parsed.data.blockTime * 1000) }
}

export async function getTreasuryBalance(wallet: string) {
  await assertMainnet()
  const data = z.object({ value: z.array(z.object({ account: z.object({ data: z.object({ parsed: z.object({ info: z.object({ mint: z.string(), tokenAmount: z.object({ amount: z.string().regex(/^\d+$/), decimals: z.number() }) }) }) }) }) })) }).parse(await rpc('getTokenAccountsByOwner', [wallet, { mint: USDC_MINT }, { commitment: 'finalized', encoding: 'jsonParsed' }]))
  return new Prisma.Decimal(data.value.reduce((sum, row) => row.account.data.parsed.info.mint === USDC_MINT && row.account.data.parsed.info.tokenAmount.decimals === 6 ? sum + BigInt(row.account.data.parsed.info.tokenAmount.amount) : sum, 0n).toString()).div(1e6)
}
