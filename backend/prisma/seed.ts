import { MissionStatus, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const markets = [
  { symbol: 'BONK', mintAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { symbol: 'WIF', mintAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
  { symbol: 'POPCAT', mintAddress: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', decimals: 9 },
  { symbol: 'PENGU', mintAddress: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv', decimals: 6 },
  { symbol: 'FARTCOIN', mintAddress: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', decimals: 6 },
] as const

const competitorProfiles = [
  { username: 'operator02', cashBalance: '7500', symbol: 'BONK', quantity: '120000000', averageEntryPrice: '0.00001900', realizedPnl: '40' },
  { username: 'operator03', cashBalance: '7600', symbol: 'WIF', quantity: '1100', averageEntryPrice: '2.00000000', realizedPnl: '75' },
  { username: 'operator04', cashBalance: '8200', symbol: 'POPCAT', quantity: '2500', averageEntryPrice: '0.68000000', realizedPnl: '-20' },
  { username: 'operator05', cashBalance: '7000', symbol: 'PENGU', quantity: '90000', averageEntryPrice: '0.02900000', realizedPnl: '110' },
  { username: 'operator06', cashBalance: '8000', symbol: 'FARTCOIN', quantity: '1600', averageEntryPrice: '1.10000000', realizedPnl: '15' },
] as const

async function main() {
  const now = Date.now()
  const startsAt = new Date(now - 60 * 60 * 1_000)
  const endsAt = new Date(now + 23 * 60 * 60 * 1_000)

  const mission = await prisma.mission.upsert({
    where: { slug: 'operation-nightfall' },
    create: {
      name: 'Operation Nightfall',
      slug: 'operation-nightfall',
      description: 'A live paper-trading mission across five Solana meme coin markets.',
      status: MissionStatus.ACTIVE,
      startingBalance: '10000',
      startsAt,
      endsAt,
      allowDynamicMarkets: false,
    },
    update: {
      name: 'Operation Nightfall',
      description: 'A live paper-trading mission across five Solana meme coin markets.',
      status: MissionStatus.ACTIVE,
      startingBalance: '10000',
      startsAt,
      endsAt,
      allowDynamicMarkets: false,
    },
  })

  const seededMarkets = await Promise.all(
    markets.map((market) =>
      prisma.missionMarket.upsert({
        where: { missionId_mintAddress: { missionId: mission.id, mintAddress: market.mintAddress } },
        update: { mintAddress: market.mintAddress, decimals: market.decimals, enabled: true },
        create: {
          missionId: mission.id,
          symbol: market.symbol,
          mintAddress: market.mintAddress,
          decimals: market.decimals,
          enabled: true,
        },
      }),
    ),
  )
  const marketBySymbol = new Map(seededMarkets.map((market) => [market.symbol, market]))


  for (const [index, profile] of competitorProfiles.entries()) {
    const user = await prisma.user.upsert({
      where: { username: profile.username },
      update: {},
      create: { username: profile.username },
    })
    const entry = await prisma.missionEntry.upsert({
      where: { missionId_userId: { missionId: mission.id, userId: user.id } },
      update: {
        startingBalance: '10000',
        cashBalance: profile.cashBalance,
        realizedPnl: profile.realizedPnl,
      },
      create: {
        missionId: mission.id,
        userId: user.id,
        startingBalance: '10000',
        cashBalance: profile.cashBalance,
        realizedPnl: profile.realizedPnl,
        joinedAt: new Date(startsAt.getTime() - (competitorProfiles.length - index) * 60_000),
      },
    })
    const market = marketBySymbol.get(profile.symbol)
    if (!market) throw new Error(`Seed market ${profile.symbol} is missing.`)
    await prisma.position.upsert({
      where: { missionEntryId_missionMarketId: { missionEntryId: entry.id, missionMarketId: market.id } },
      update: {
        quantity: profile.quantity,
        averageEntryPrice: profile.averageEntryPrice,
        realizedPnl: profile.realizedPnl,
      },
      create: {
        missionEntryId: entry.id,
        missionMarketId: market.id,
        quantity: profile.quantity,
        averageEntryPrice: profile.averageEntryPrice,
        realizedPnl: profile.realizedPnl,
      },
    })
  }

  const openArena = await prisma.mission.upsert({
    where: { slug: 'open-arena' },
    create: {
      name: 'Open Arena',
      slug: 'open-arena',
      description: 'Scout and paper-trade new Jupiter-routable Solana tokens after automated liquidity and route checks.',
      status: MissionStatus.ACTIVE,
      startingBalance: '10000',
      startsAt,
      endsAt,
      allowDynamicMarkets: true,
    },
    update: {
      name: 'Open Arena',
      description: 'Scout and paper-trade new Jupiter-routable Solana tokens after automated liquidity and route checks.',
      status: MissionStatus.ACTIVE,
      startingBalance: '10000',
      startsAt,
      endsAt,
      allowDynamicMarkets: true,
    },
  })

  await Promise.all(
    markets.map((market) => prisma.missionMarket.upsert({
      where: { missionId_mintAddress: { missionId: openArena.id, mintAddress: market.mintAddress } },
      update: { symbol: market.symbol, decimals: market.decimals, enabled: true },
      create: { missionId: openArena.id, ...market, enabled: true },
    })),
  )
}

main()
  .then(() => console.log('Seeded fixed Operation Nightfall rankings and the dynamic Open Arena.'))
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
