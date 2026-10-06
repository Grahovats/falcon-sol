ALTER TABLE "Position"
  ADD COLUMN "takeProfitPrice" DECIMAL(30,12),
  ADD COLUMN "stopLossPrice" DECIMAL(30,12),
  ADD COLUMN "protectionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "exitReason" TEXT;
ALTER TABLE "Position" ADD CONSTRAINT "Position_exit_prices_check" CHECK (
  ("takeProfitPrice" IS NULL OR "takeProfitPrice" > 0) AND
  ("stopLossPrice" IS NULL OR "stopLossPrice" > 0) AND
  ("takeProfitPrice" IS NULL OR "stopLossPrice" IS NULL OR "takeProfitPrice" > "stopLossPrice")
);
