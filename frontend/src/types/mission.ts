export const missionStatuses = ['DRAFT', 'REGISTRATION', 'LOCKED', 'ACTIVE', 'BLACKOUT', 'SETTLING', 'FINALIZED', 'CLOSED', 'CANCELLED'] as const
export type MissionStatus = (typeof missionStatuses)[number]

export interface Mission {
  rewards?: MissionRewards | null
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

export interface CashEntryInput { country: string; adult: boolean; acceptedRules: boolean; rulesVersion: number }
export interface MissionRewards {
  mode: string; state: string; sponsorName: string; organizerName: string; treasuryWallet: string;
  minimumPool: string; fundedPool: string; prizePool: string; entryFee: string; paidEntryAvailable: boolean;
  minimumEntrants: number; eligibleCountries: string[]; fundingDeadline: string; registrationClosesAt: string;
  rulesText: string; rulesVersion: number; termsApproved: boolean; reviewEndsAt: string | null; payoutDueAt: string | null;
  cancelReason: string | null; payoutSplit: number[]; indicativePrizes: string[];
  funding: { id: string; sponsorName: string; amount: string; signature: string; returnSignature: string | null }[];
  awards: { id: string; userId: string; displayName: string; rank: number; amount: string; status: string; payoutSignature: string | null }[];
}
