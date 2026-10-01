import type { ApiEnvelope, MissionStatus } from '../types/mission'
import { apiGet, apiPatch, apiPost } from './client'

export interface AdminMarket { id: string; symbol: string; mintAddress: string; decimals: number; enabled: boolean; settlementPrice: string | null; settledAt: string | null }
export interface AdminMission { id: string; name: string; slug: string; description: string | null; status: MissionStatus; startingBalance: string; startsAt: string; endsAt: string; settledAt: string | null; lifecycleError: string | null; operatorCount: number; resultCount: number; markets: AdminMarket[] }
export interface AuditLog { id: string; actorType: 'ADMIN' | 'SYSTEM'; actorWallet: string | null; action: string; entityType: string; entityId: string; missionId: string | null; metadata: unknown; createdAt: string }
export interface MissionInput { name: string; description: string | null; status: MissionStatus; startingBalance: number; startsAt: string; endsAt: string }

export function getAuditLogs(signal?: AbortSignal) { return apiGet<ApiEnvelope<AuditLog[]>>('/admin/audit-logs', signal) }
export function getAdminMissions(signal?: AbortSignal) { return apiGet<ApiEnvelope<AdminMission[]>>('/admin/missions', signal) }
export function createMission(input: MissionInput) { return apiPost<ApiEnvelope<AdminMission>>('/admin/missions', input) }
export function updateMission(id: string, input: Partial<MissionInput>) { return apiPatch<ApiEnvelope<AdminMission>>(`/admin/missions/${encodeURIComponent(id)}`, input) }
export function createMarket(missionId: string, input: { symbol: string; mintAddress: string; decimals?: number; enabled: boolean }) { return apiPost<ApiEnvelope<AdminMarket>>(`/admin/missions/${encodeURIComponent(missionId)}/markets`, input) }
export function updateMarket(missionId: string, marketId: string, input: Partial<Pick<AdminMarket, 'symbol' | 'mintAddress' | 'decimals' | 'enabled'>>) { return apiPatch<ApiEnvelope<AdminMarket>>(`/admin/missions/${encodeURIComponent(missionId)}/markets/${encodeURIComponent(marketId)}`, input) }
