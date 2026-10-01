import { Prisma } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'

export function decimalToAtomic(value: Decimal, decimals: number) {
  return value
    .mul(new Prisma.Decimal(10).pow(decimals))
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR)
    .toFixed(0)
}

export function atomicToDecimal(value: string, decimals: number) {
  return new Prisma.Decimal(value).div(new Prisma.Decimal(10).pow(decimals))
}
