CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'FILLED', 'REJECTED', 'CANCELLED');

ALTER TABLE "MissionEntry" ADD COLUMN "realizedPnl" DECIMAL(20,6) NOT NULL DEFAULT 0;

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "missionEntryId" TEXT NOT NULL,
    "missionMarketId" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "requestedNotional" DECIMAL(20,6) NOT NULL,
    "requestedQuantity" DECIMAL(30,12),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Fill" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "executionPrice" DECIMAL(30,12) NOT NULL,
    "quantity" DECIMAL(30,12) NOT NULL,
    "notional" DECIMAL(20,6) NOT NULL,
    "simulatedFee" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "missionEntryId" TEXT NOT NULL,
    "missionMarketId" TEXT NOT NULL,
    "quantity" DECIMAL(30,12) NOT NULL DEFAULT 0,
    "averageEntryPrice" DECIMAL(30,12) NOT NULL DEFAULT 0,
    "realizedPnl" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Order_missionEntryId_createdAt_idx" ON "Order"("missionEntryId", "createdAt");
CREATE INDEX "Order_missionMarketId_idx" ON "Order"("missionMarketId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE UNIQUE INDEX "Fill_orderId_key" ON "Fill"("orderId");
CREATE INDEX "Fill_createdAt_idx" ON "Fill"("createdAt");
CREATE UNIQUE INDEX "Position_missionEntryId_missionMarketId_key" ON "Position"("missionEntryId", "missionMarketId");
CREATE INDEX "Position_missionMarketId_idx" ON "Position"("missionMarketId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_missionEntryId_fkey" FOREIGN KEY ("missionEntryId") REFERENCES "MissionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_missionMarketId_fkey" FOREIGN KEY ("missionMarketId") REFERENCES "MissionMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_missionEntryId_fkey" FOREIGN KEY ("missionEntryId") REFERENCES "MissionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_missionMarketId_fkey" FOREIGN KEY ("missionMarketId") REFERENCES "MissionMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
