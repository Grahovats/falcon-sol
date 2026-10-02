ALTER TABLE "Mission" ADD COLUMN "allowDynamicMarkets" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX "MissionMarket_missionId_symbol_key";
CREATE UNIQUE INDEX "MissionMarket_missionId_mintAddress_key" ON "MissionMarket"("missionId", "mintAddress");
