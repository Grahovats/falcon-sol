import { describe, expect, it } from 'vitest'
import { buildGlobalRankings, type RankingResult } from './ranking-service.js'

function result(overrides: Partial<RankingResult> & Pick<RankingResult, 'userId' | 'rank' | 'returnPercent'>): RankingResult {
  return { displayName: overrides.userId, walletAddress: null, pnl: '0', ...overrides }
}

describe('global ranking aggregation', () => {
  it('aggregates settled performance and orders by average return', () => {
    const rankings = buildGlobalRankings([
      result({ userId: 'alpha', rank: 1, returnPercent: '10', pnl: '1000', displayName: 'Alpha' }),
      result({ userId: 'alpha', rank: 4, returnPercent: '-2', pnl: '-200', displayName: 'Alpha' }),
      result({ userId: 'bravo', rank: 2, returnPercent: '6', pnl: '600', displayName: 'Bravo' }),
    ])
    expect(rankings.map((row) => row.userId)).toEqual(['bravo', 'alpha'])
    expect(rankings[1]).toMatchObject({ rank: 2, missionsPlayed: 2, wins: 1, podiums: 1, averageReturn: '4', bestReturn: '10', totalPnl: '800' })
  })

  it('uses wins, podiums, best return, and user id as deterministic tie breakers', () => {
    const rankings = buildGlobalRankings([
      result({ userId: 'charlie', rank: 3, returnPercent: '5' }),
      result({ userId: 'bravo', rank: 1, returnPercent: '5' }),
      result({ userId: 'alpha', rank: 1, returnPercent: '5' }),
    ])
    expect(rankings.map((row) => row.userId)).toEqual(['alpha', 'bravo', 'charlie'])
  })

  it('preserves the least-negative return as the best result', () => {
    const [operator] = buildGlobalRankings([
      result({ userId: 'alpha', rank: 4, returnPercent: '-12' }),
      result({ userId: 'alpha', rank: 5, returnPercent: '-4' }),
    ])
    expect(operator?.bestReturn).toBe('-4')
    expect(operator?.averageReturn).toBe('-8')
  })

  it('returns no standings before any mission settles', () => {
    expect(buildGlobalRankings([])).toEqual([])
  })
})
