-- AlterTable
ALTER TABLE "User" ADD COLUMN     "identityHash" TEXT;

-- CreateTable
CREATE TABLE "MissionRewardPlan" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SPONSORED',
    "state" TEXT NOT NULL DEFAULT 'FUNDING',
    "sponsorName" TEXT NOT NULL,
    "organizerName" TEXT NOT NULL,
    "treasuryWallet" TEXT NOT NULL,
    "minimumPool" DECIMAL(20,6) NOT NULL,
    "entryFee" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "platformFeeBps" INTEGER NOT NULL DEFAULT 1000,
    "minimumEntrants" INTEGER NOT NULL DEFAULT 3,
    "fundingDeadline" TIMESTAMP(3) NOT NULL,
    "registrationClosesAt" TIMESTAMP(3) NOT NULL,
    "eligibleCountries" TEXT[],
    "rulesText" TEXT NOT NULL,
    "rulesVersion" INTEGER NOT NULL DEFAULT 1,
    "termsApproved" BOOLEAN NOT NULL DEFAULT false,
    "lockedPool" DECIMAL(20,6),
    "lockedAt" TIMESTAMP(3),
    "reviewEndsAt" TIMESTAMP(3),
    "payoutDueAt" TIMESTAMP(3),
    "preparedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionRewardPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionFunding" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sponsorName" TEXT NOT NULL,
    "senderWallet" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "signature" TEXT NOT NULL,
    "chainSlot" BIGINT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnSignature" TEXT,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "MissionFunding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashParticipant" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "rulesVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionAward" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payoutSignature" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "MissionAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionRewardPlan_missionId_key" ON "MissionRewardPlan"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionRewardPlan_treasuryWallet_key" ON "MissionRewardPlan"("treasuryWallet");

-- CreateIndex
CREATE UNIQUE INDEX "MissionFunding_signature_key" ON "MissionFunding"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "MissionFunding_returnSignature_key" ON "MissionFunding"("returnSignature");

-- CreateIndex
CREATE UNIQUE INDEX "CashParticipant_missionId_userId_key" ON "CashParticipant"("missionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionAward_payoutSignature_key" ON "MissionAward"("payoutSignature");

-- CreateIndex
CREATE UNIQUE INDEX "MissionAward_planId_userId_key" ON "MissionAward"("planId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_identityHash_key" ON "User"("identityHash");

-- AddForeignKey
ALTER TABLE "MissionRewardPlan" ADD CONSTRAINT "MissionRewardPlan_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionFunding" ADD CONSTRAINT "MissionFunding_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MissionRewardPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashParticipant" ADD CONSTRAINT "CashParticipant_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashParticipant" ADD CONSTRAINT "CashParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAward" ADD CONSTRAINT "MissionAward_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MissionRewardPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

