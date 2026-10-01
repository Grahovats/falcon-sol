import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { buildSettlementResults } from './mission-lifecycle-service.js'

const amount = (value: string) => new Prisma.Decimal(value)

describe('mission settlement', () => {
  it('uses one locked price map and deterministic join-time tie breaking', () => {
    const results = buildSettlementResults([
      { userId: 'later', startingBalance: amount('1000'), cashBalance: amount('500'), joinedAt: new Date('2026-01-01T00:01:00Z'), positions: [{ missionMarketId: 'SOL', quantity: amount('5') }], user: { username: 'later', wallets: [] } },
      { userId: 'first', startingBalance: amount('1000'), cashBalance: amount('500'), joinedAt: new Date('2026-01-01T00:00:00Z'), positions: [{ missionMarketId: 'SOL', quantity: amount('5') }], user: { username: 'first', wallets: [] } },
      { userId: 'winner', startingBalance: amount('1000'), cashBalance: amount('700'), joinedAt: new Date('2026-01-01T00:02:00Z'), positions: [{ missionMarketId: 'SOL', quantity: amount('5') }], user: { username: 'winner', wallets: [] } },
    ], new Map([['SOL', amount('100')]]))

    expect(results.map((result) => [result.userId, result.rank, result.equity.toString()])).toEqual([
      ['winner', 1, '1200'], ['first', 2, '1000'], ['later', 3, '1000'],
    ])
  })

  it('fails closed when a settlement price is missing', () => {
    expect(() => buildSettlementResults([
      { userId: 'user', startingBalance: amount('1000'), cashBalance: amount('500'), joinedAt: new Date(), positions: [{ missionMarketId: 'missing', quantity: amount('1') }], user: { username: null, wallets: [] } },
    ], new Map())).toThrow('Missing settlement price')
  })
})
