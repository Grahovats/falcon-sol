import type { ApiEnvelope, Mission } from '../types/mission'
import { apiGet } from './client'

export function getMissions(signal?: AbortSignal) { return apiGet<ApiEnvelope<Mission[]>>('/missions', signal) }
export function getMission(id: string, signal?: AbortSignal) { return apiGet<ApiEnvelope<Mission>>(`/missions/${encodeURIComponent(id)}`, signal) }
