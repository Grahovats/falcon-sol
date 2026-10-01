import { MissionStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { deriveMissionStatus, isTradingOpen, nextAutomatedMissionStatus } from './mission-state-service.js'

const now = new Date('2026-09-29T12:00:00.000Z')

describe('mission state', () => {
  it('keeps an upcoming mission in registration', () => {
    expect(deriveMissionStatus({ status: MissionStatus.REGISTRATION, startsAt: new Date('2026-09-29T13:00:00Z'), endsAt: new Date('2026-09-29T14:00:00Z') }, now)).toBe('REGISTRATION')
  })

  it('derives active and blackout windows', () => {
    expect(deriveMissionStatus({ status: MissionStatus.ACTIVE, startsAt: new Date('2026-09-29T11:00:00Z'), endsAt: new Date('2026-09-29T13:00:00Z') }, now)).toBe('ACTIVE')
    expect(deriveMissionStatus({ status: MissionStatus.ACTIVE, startsAt: new Date('2026-09-29T11:00:00Z'), endsAt: new Date('2026-09-29T12:02:00Z') }, now)).toBe('BLACKOUT')
  })

  it('moves an ended mission into settlement and rejects trading', () => {
    const status = deriveMissionStatus({ status: MissionStatus.ACTIVE, startsAt: new Date('2026-09-29T10:00:00Z'), endsAt: new Date('2026-09-29T11:00:00Z') }, now)
    expect(status).toBe('SETTLING')
    expect(isTradingOpen(status)).toBe(false)
  })

  it('plans automatic registration, active, blackout, and settlement transitions', () => {
    expect(nextAutomatedMissionStatus({ status: MissionStatus.REGISTRATION, startsAt: new Date('2026-09-29T11:00:00Z'), endsAt: new Date('2026-09-29T14:00:00Z') }, now)).toBe('ACTIVE')
    expect(nextAutomatedMissionStatus({ status: MissionStatus.ACTIVE, startsAt: new Date('2026-09-29T11:00:00Z'), endsAt: new Date('2026-09-29T12:02:00Z') }, now)).toBe('BLACKOUT')
    expect(nextAutomatedMissionStatus({ status: MissionStatus.BLACKOUT, startsAt: new Date('2026-09-29T10:00:00Z'), endsAt: new Date('2026-09-29T11:00:00Z') }, now)).toBe('SETTLING')
  })

  it('leaves cancelled missions terminal', () => {
    expect(nextAutomatedMissionStatus({ status: MissionStatus.CANCELLED, startsAt: new Date('2026-09-29T10:00:00Z'), endsAt: new Date('2026-09-29T11:00:00Z') }, now)).toBeNull()
  })

})
