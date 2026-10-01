CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'LOCKED', 'ACTIVE', 'BLACKOUT', 'SETTLING', 'FINALIZED', 'CLOSED', 'CANCELLED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT',
    "startingBalance" DECIMAL(20,6) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MissionMarket" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "mintAddress" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MissionMarket_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MissionEntry" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startingBalance" DECIMAL(20,6) NOT NULL,
    "cashBalance" DECIMAL(20,6) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");
CREATE UNIQUE INDEX "Mission_slug_key" ON "Mission"("slug");
CREATE INDEX "Mission_status_startsAt_idx" ON "Mission"("status", "startsAt");
CREATE UNIQUE INDEX "MissionMarket_missionId_symbol_key" ON "MissionMarket"("missionId", "symbol");
CREATE INDEX "MissionMarket_missionId_idx" ON "MissionMarket"("missionId");
CREATE UNIQUE INDEX "MissionEntry_missionId_userId_key" ON "MissionEntry"("missionId", "userId");
CREATE INDEX "MissionEntry_userId_idx" ON "MissionEntry"("userId");

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionMarket" ADD CONSTRAINT "MissionMarket_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionEntry" ADD CONSTRAINT "MissionEntry_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionEntry" ADD CONSTRAINT "MissionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
