export const missionStatuses = ['DRAFT', 'REGISTRATION', 'LOCKED', 'ACTIVE', 'BLACKOUT', 'SETTLING', 'FINALIZED', 'CLOSED', 'CANCELLED'] as const
export type MissionStatus = (typeof missionStatuses)[number]

export interface Mission {
  id: string
  name: string
  slug: string
  description: string | null
  status: MissionStatus
  startingBalance: string
  startsAt: string
  endsAt: string
  allowDynamicMarkets: boolean
  marketCount: number
  operatorCount: number
  markets: MissionMarket[]
}

export interface MissionMarket {
  id: string
  symbol: string
  mintAddress: string
  decimals: number
  enabled: boolean
}

export interface ApiEnvelope<T> { data: T }
