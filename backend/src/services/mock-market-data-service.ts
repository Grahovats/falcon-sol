import { Prisma } from '@prisma/client'
import { MockPriceService } from './mock-price-service.js'
import type { ExecutionQuote, MarketDataService, PriceMarket } from './price-service.js'
import { atomicToDecimal, decimalToAtomic } from './token-amount.js'

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export class MockMarketDataService extends MockPriceService implements MarketDataService {
  async getBuyQuote(market: PriceMarket, requestedNotional: Prisma.Decimal): Promise<ExecutionQuote> {
    const price = (await this.getPrice(market)).price
    const inputAmount = decimalToAtomic(requestedNotional, 6)
    const notional = atomicToDecimal(inputAmount, 6)
    const outputAmount = decimalToAtomic(notional.div(price), market.decimals)
    const quantity = atomicToDecimal(outputAmount, market.decimals)
    return this.createQuote(market, { inputMint: USDC_MINT, outputMint: market.mintAddress, inputAmount, outputAmount, quantity, notional, price })
  }

  async getSellQuote(market: PriceMarket, requestedQuantity: Prisma.Decimal): Promise<ExecutionQuote> {
    const price = (await this.getPrice(market)).price
    const inputAmount = decimalToAtomic(requestedQuantity, market.decimals)
    const quantity = atomicToDecimal(inputAmount, market.decimals)
    const outputAmount = decimalToAtomic(quantity.mul(price), 6)
    const notional = atomicToDecimal(outputAmount, 6)
    return this.createQuote(market, { inputMint: market.mintAddress, outputMint: USDC_MINT, inputAmount, outputAmount, quantity, notional, price })
  }

  private createQuote(
    market: PriceMarket,
    values: {
      inputMint: string
      outputMint: string
      inputAmount: string
      outputAmount: string
      quantity: Prisma.Decimal
      notional: Prisma.Decimal
      price: Prisma.Decimal
    },
  ): ExecutionQuote {
    const quotedAt = new Date()
    return {
      provider: 'mock',
      requestId: `mock:${market.id}:${quotedAt.getTime()}`,
      quoteId: null,
      router: 'deterministic',
      inputMint: values.inputMint,
      outputMint: values.outputMint,
      inputAmount: values.inputAmount,
      outputAmount: values.outputAmount,
      quantity: values.quantity,
      notional: values.notional,
      executionPrice: values.notional.div(values.quantity),
      referencePrice: values.price,
      priceImpactPercent: new Prisma.Decimal(0),
      simulatedFee: new Prisma.Decimal(0),
      routePlan: [],
      quotedAt,
      expiresAt: null,
    }
  }
}
