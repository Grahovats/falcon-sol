import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { MissionStatus, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const now = Date.now()
  const mission = await prisma.mission.create({
    data: {
      name: 'Terminal Test Flight',
      slug: `terminal-test-flight-${randomUUID()}`,
      description: 'A seven-day paper-trading mission for testing the trading terminal. Deploy with 10,000 virtual USDC and practice buying and selling across five markets.',
      status: MissionStatus.ACTIVE,
      startingBalance: '10000',
      startsAt: new Date(now - 60_000),
      endsAt: new Date(now + 7 * 24 * 60 * 60 * 1_000),
      allowDynamicMarkets: false,
      markets: {
        create: [
          { symbol: 'BONK', mintAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
          { symbol: 'WIF', mintAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
          { symbol: 'POPCAT', mintAddress: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', decimals: 9 },
          { symbol: 'PENGU', mintAddress: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv', decimals: 6 },
          { symbol: 'FARTCOIN', mintAddress: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', decimals: 6 },
        ],
      },
    },
  })

  console.log(`Created ${mission.name} with 10,000 virtual USDC and five markets.`)
  console.log(`Ends: ${mission.endsAt.toISOString()}`)
  console.log(`Open: http://localhost:5173/missions/${mission.id}`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
