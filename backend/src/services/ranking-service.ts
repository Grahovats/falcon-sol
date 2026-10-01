import { decimal, type DecimalInput } from './trading-calculations.js'

export interface RankingResult {
  userId: string
  displayName: string
  walletAddress: string | null
  rank: number
  pnl: DecimalInput
  returnPercent: DecimalInput
}

export interface GlobalRanking {
  rank: number
  userId: string
  displayName: string
  wallet: string | null
  missionsPlayed: number
  wins: number
  podiums: number
  averageReturn: string
  bestReturn: string
  totalPnl: string
}

export function buildGlobalRankings(results: RankingResult[]): GlobalRanking[] {
  const operators = new Map<string, Omit<GlobalRanking, 'rank' | 'averageReturn' | 'bestReturn' | 'totalPnl'> & {
    totalReturn: ReturnType<typeof decimal>
    bestReturnValue: ReturnType<typeof decimal>
    totalPnlValue: ReturnType<typeof decimal>
  }>()

  for (const result of results) {
    const returnPercent = decimal(result.returnPercent)
    const existing = operators.get(result.userId)
    if (existing) {
      existing.wallet ??= result.walletAddress
      existing.missionsPlayed += 1
      existing.wins += result.rank === 1 ? 1 : 0
      existing.podiums += result.rank <= 3 ? 1 : 0
      existing.totalReturn = existing.totalReturn.plus(returnPercent)
      existing.bestReturnValue = maxDecimal(existing.bestReturnValue, returnPercent)
      existing.totalPnlValue = existing.totalPnlValue.plus(result.pnl)
      continue
    }

    operators.set(result.userId, {
      userId: result.userId,
      displayName: result.displayName,
      wallet: result.walletAddress,
      missionsPlayed: 1,
      wins: result.rank === 1 ? 1 : 0,
      podiums: result.rank <= 3 ? 1 : 0,
      totalReturn: returnPercent,
      bestReturnValue: returnPercent,
      totalPnlValue: decimal(result.pnl),
    })
  }

  return [...operators.values()]
    .map((operator) => ({
      ...operator,
      averageReturn: operator.totalReturn.div(operator.missionsPlayed).toString(),
      bestReturn: operator.bestReturnValue.toString(),
      totalPnl: operator.totalPnlValue.toString(),
    }))
    .sort((left, right) =>
      decimal(right.averageReturn).comparedTo(left.averageReturn)
      || right.wins - left.wins
      || right.podiums - left.podiums
      || decimal(right.bestReturn).comparedTo(left.bestReturn)
      || left.userId.localeCompare(right.userId))
    .map((operator, index) => ({
      rank: index + 1,
      userId: operator.userId,
      displayName: operator.displayName,
      wallet: operator.wallet,
      missionsPlayed: operator.missionsPlayed,
      wins: operator.wins,
      podiums: operator.podiums,
      averageReturn: operator.averageReturn,
      bestReturn: operator.bestReturn,
      totalPnl: operator.totalPnl,
    }))
}

function maxDecimal(left: ReturnType<typeof decimal>, right: ReturnType<typeof decimal>) {
  return left.comparedTo(right) >= 0 ? left : right
}
