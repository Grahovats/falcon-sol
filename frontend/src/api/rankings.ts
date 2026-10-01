import type { MissionStatus } from '../types/mission'
import { apiGet } from './client'

export interface RankingRow {
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

export interface MissionRankingRow {
  rank: number
  userId: string
  displayName: string
  wallet: string | null
  equity: string
  pnl: string
  returnPercent: string
}

export interface MissionRanking {
  id: string
  name: string
  slug: string
  status: MissionStatus
  startsAt: string
  endsAt: string
  operatorCount: number
  hidden: boolean
  rows: MissionRankingRow[]
}

export interface RankingsPayload {
  overall: RankingRow[]
  liveMissions: MissionRanking[]
  finalizedMissions: MissionRanking[]
}

export interface RankingsMeta {
  finalizedMissionCount: number
  rankedOperatorCount: number
  generatedAt: string
}

export interface OperatorResult {
  missionId: string
  missionName: string
  rank: number
  equity: string
  returnPercent: string
  settledAt: string
}

export interface OperatorSummary {
  userId: string
  username: string
  wallet: string | null
  missionsEntered: number
  bestResult: OperatorResult | null
  averageReturn: string
  wins: number
  topThreeFinishes: number
  results: OperatorResult[]
}

export function getRankings(signal?: AbortSignal) {
  return apiGet<{ data: RankingsPayload; meta: RankingsMeta }>('/rankings', signal)
}

export function getOperator(userId: string, signal?: AbortSignal) {
  return apiGet<{ data: OperatorSummary }>(`/operators/${encodeURIComponent(userId)}`, signal)
}
