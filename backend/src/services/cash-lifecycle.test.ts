import { type PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { MissionLifecycleService } from './mission-lifecycle-service.js'
import type { MarketDataService } from './price-service.js'
const now = new Date('2026-10-12T18:00:00Z')
function harness(state: string, endsAt: Date, entrants = 0) {
  const plan = { id: 'plan', state, fundingDeadline: new Date(now.getTime() - 1000), registrationClosesAt: new Date(now.getTime() - 1000), minimumEntrants: 3 }
  const mission = { id: 'mission', status: 'REGISTRATION', rewardPlan: plan, startsAt: new Date(now.getTime() - 500), endsAt, markets: [] }
  const database = { mission: { findMany: vi.fn().mockResolvedValue([mission]), update: vi.fn(), updateMany: vi.fn() }, missionRewardPlan: { findUnique: vi.fn().mockResolvedValue(plan), update: vi.fn() }, cashParticipant: { count: vi.fn().mockResolvedValue(entrants) }, position: { findMany: vi.fn().mockResolvedValue([]) }, adminAuditLog: { create: vi.fn() }, $transaction: vi.fn() }
  database.$transaction.mockImplementation((operation: (tx: typeof database) => unknown) => operation(database))
  const service = new MissionLifecycleService(database as unknown as PrismaClient, {} as MarketDataService)
  return { database, service }
}
describe('cash mission lifecycle', () => {
  it('cancels missed funding without activating trading', async () => {
    const { database, service } = harness('FUNDING', new Date(now.getTime() + 86400000)); await service.runOnce(now)
    expect(database.mission.update).toHaveBeenCalledWith({ where: { id: 'mission' }, data: { status: 'CANCELLED', lifecycleError: null } })
    expect(database.missionRewardPlan.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'CANCELLED' }) }))
    expect(database.mission.updateMany).not.toHaveBeenCalled()
  })
  it('cancels without the minimum approved entrants', async () => {
    const { database, service } = harness('READY', new Date(now.getTime() + 86400000), 2); await service.runOnce(now)
    expect(database.missionRewardPlan.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'CANCELLED' }) }))
    expect(database.mission.updateMany).not.toHaveBeenCalled()
  })
  it('cancels when the settlement worker arrives outside the published window', async () => {
    const { database, service } = harness('LOCKED', new Date(now.getTime() - 60001)); await service.runOnce(now)
    expect(database.missionRewardPlan.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ cancelReason: expect.stringContaining('60-second') }) }))
    expect(database.mission.updateMany).not.toHaveBeenCalled()
  })
  it('does not open a hybrid plan merely because the schedule has started', async () => {
    const { database, service } = harness('PAYMENT_DISABLED', new Date(now.getTime() + 86400000)); await service.runOnce(now)
    expect(database.mission.updateMany).not.toHaveBeenCalled(); expect(database.missionRewardPlan.update).not.toHaveBeenCalled()
  })
})
