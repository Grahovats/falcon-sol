import { MissionStatus, type Mission } from '@prisma/client'

export const BLACKOUT_DURATION_MS = 3 * 60 * 1_000

type MissionSchedule = Pick<Mission, 'status' | 'startsAt' | 'endsAt'>

export function deriveMissionStatus(mission: MissionSchedule, now = new Date()): MissionStatus {
  if (mission.status === MissionStatus.CANCELLED || mission.status === MissionStatus.CLOSED || mission.status === MissionStatus.FINALIZED) {
    return mission.status
  }
  if (mission.status === MissionStatus.DRAFT) return MissionStatus.DRAFT

  const currentTime = now.getTime()
  if (currentTime >= mission.endsAt.getTime()) return MissionStatus.SETTLING
  if (currentTime < mission.startsAt.getTime()) {
    return mission.status === MissionStatus.LOCKED ? MissionStatus.LOCKED : MissionStatus.REGISTRATION
  }
  if (mission.status === MissionStatus.SETTLING) return MissionStatus.SETTLING
  if (mission.endsAt.getTime() - currentTime <= BLACKOUT_DURATION_MS) return MissionStatus.BLACKOUT
  return MissionStatus.ACTIVE
}

export function isTradingOpen(status: MissionStatus) {
  return status === MissionStatus.ACTIVE || status === MissionStatus.BLACKOUT
}

export function acceptsEntries(status: MissionStatus) {
  return status === MissionStatus.REGISTRATION || status === MissionStatus.ACTIVE
}

export function isLeaderboardHidden(status: MissionStatus) {
  return status === MissionStatus.BLACKOUT || status === MissionStatus.SETTLING
}


export function nextAutomatedMissionStatus(mission: MissionSchedule, now = new Date()): MissionStatus | null {
  if (([MissionStatus.DRAFT, MissionStatus.CANCELLED, MissionStatus.CLOSED, MissionStatus.FINALIZED] as MissionStatus[]).includes(mission.status)) return null
  const currentTime = now.getTime()
  if (mission.status === MissionStatus.SETTLING) return MissionStatus.SETTLING
  if (currentTime >= mission.endsAt.getTime()) return MissionStatus.SETTLING
  if (currentTime >= mission.startsAt.getTime() && mission.endsAt.getTime() - currentTime <= BLACKOUT_DURATION_MS) return MissionStatus.BLACKOUT
  if (currentTime >= mission.startsAt.getTime()) return MissionStatus.ACTIVE
  if (mission.status === MissionStatus.LOCKED) return MissionStatus.LOCKED
  return MissionStatus.REGISTRATION
}
