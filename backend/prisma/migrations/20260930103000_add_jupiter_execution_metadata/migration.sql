ALTER TABLE "MissionMarket" ADD COLUMN "decimals" INTEGER NOT NULL DEFAULT 6;

ALTER TABLE "Fill"
ADD COLUMN "referencePrice" DECIMAL(30,12),
ADD COLUMN "priceImpactPct" DECIMAL(12,8),
ADD COLUMN "quoteProvider" TEXT NOT NULL DEFAULT 'mock',
ADD COLUMN "quoteRequestId" TEXT,
ADD COLUMN "quoteId" TEXT,
ADD COLUMN "quoteRouter" TEXT,
ADD COLUMN "inputMint" TEXT,
ADD COLUMN "outputMint" TEXT,
ADD COLUMN "inputAmount" TEXT,
ADD COLUMN "outputAmount" TEXT,
ADD COLUMN "routePlan" JSONB,
ADD COLUMN "quotedAt" TIMESTAMP(3),
ADD COLUMN "quoteExpiresAt" TIMESTAMP(3);

CREATE INDEX "Fill_quoteRequestId_idx" ON "Fill"("quoteRequestId");

