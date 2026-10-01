import type { PrismaClient } from '@prisma/client'
import { AppError } from '../errors/app-error.js'

export async function getDemoUser(database: PrismaClient) {
  const user = await database.user.findUnique({ where: { username: 'operator01' } })
  if (!user) {
    throw new AppError('DEMO_USER_NOT_FOUND', 'The demo operator has not been seeded.', 500)
  }
  return user
}
