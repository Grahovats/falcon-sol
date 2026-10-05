import type { FastifyPluginAsync } from 'fastify'
import { trendingMarketService } from '../services/trending-market.js'

export const marketRoutes: FastifyPluginAsync = async (app) => {
  app.get('/market/trending', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async () => ({
    data: await trendingMarketService.getTrending(10),
  }))
}
