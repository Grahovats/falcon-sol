import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findResults, findMissions } = vi.hoisted(() => ({
  findResults: vi.fn(),
  findMissions: vi.fn(),
}))

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    missionResult: { findMany: findResults },
    mission: { findMany: findMissions },
  },
}))

vi.mock('../services/market-data.js', () => ({ marketDataService: {} }))

import { rankingRoutes } from './rankings.js'

describe('public rankings access', () => {
  beforeEach(() => {
    findResults.mockReset().mockResolvedValue([])
    findMissions.mockReset().mockResolvedValue([])
  })

  it('serves standings without authentication', async () => {
    const app = Fastify()
    await app.register(rankingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({ method: 'GET', url: '/api/v1/rankings' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      data: { overall: [], liveMissions: [], finalizedMissions: [] },
      meta: { finalizedMissionCount: 0, rankedOperatorCount: 0 },
    })
    expect(findResults).toHaveBeenCalledOnce()
    expect(findMissions).toHaveBeenCalledOnce()
    await app.close()
  })
})
