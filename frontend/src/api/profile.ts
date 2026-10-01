import type { ApiEnvelope } from '../types/mission'
import { apiGet } from './client'

export interface ProfileResult { missionId: string; missionName: string; rank: number | null; equity: string; returnPercent: string }
export interface ProfileSummary { userId: string; username: string; wallet: string | null; missionsEntered: number; bestResult: ProfileResult | null; averageReturn: string; wins: number; topThreeFinishes: number; results: ProfileResult[] }

export function getProfile(signal?: AbortSignal) { return apiGet<ApiEnvelope<ProfileSummary>>('/profile', signal) }
