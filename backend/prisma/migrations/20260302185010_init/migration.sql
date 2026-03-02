-- CreateTable
CREATE TABLE "Merchant" (
    "address" TEXT NOT NULL,
    "name" TEXT,
    "creditScore" INTEGER NOT NULL DEFAULT 0,
    "creditTier" INTEGER NOT NULL DEFAULT 0,
    "scoreUpdated" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "Vault" (
    "address" TEXT NOT NULL,
    "merchantAddr" TEXT NOT NULL,
    "targetAmount" BIGINT NOT NULL,
    "totalRaised" BIGINT NOT NULL DEFAULT 0,
    "totalRepaid" BIGINT NOT NULL DEFAULT 0,
    "totalToRepay" BIGINT NOT NULL DEFAULT 0,
    "interestRateBps" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "numTranches" INTEGER NOT NULL,
    "tranchesReleased" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'fundraising',
    "seniorFunded" BIGINT NOT NULL DEFAULT 0,
    "poolFunded" BIGINT NOT NULL DEFAULT 0,
    "userFunded" BIGINT NOT NULL DEFAULT 0,
    "totalSeniorRepaid" BIGINT NOT NULL DEFAULT 0,
    "totalPoolRepaid" BIGINT NOT NULL DEFAULT 0,
    "nextPaymentDue" TIMESTAMP(3),
    "lateFeeBps" INTEGER NOT NULL DEFAULT 0,
    "totalLateFees" BIGINT NOT NULL DEFAULT 0,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "vaultAddr" TEXT NOT NULL,
    "investor" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "claimedReturns" BIGINT NOT NULL DEFAULT 0,
    "investedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultEvent" (
    "id" TEXT NOT NULL,
    "vaultAddr" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneRecord" (
    "id" TEXT NOT NULL,
    "vaultAddr" TEXT NOT NULL,
    "milestoneId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "evidenceHash" TEXT,
    "approvalCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "MilestoneRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pool" (
    "address" TEXT NOT NULL,
    "admin" TEXT NOT NULL,
    "isAlpha" BOOLEAN NOT NULL,
    "totalDeposits" BIGINT NOT NULL DEFAULT 0,
    "totalAllocated" BIGINT NOT NULL DEFAULT 0,
    "maxAllocationPerVault" BIGINT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OraclePayment" (
    "id" TEXT NOT NULL,
    "vault" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "nonce" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "txHash" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OraclePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- AddForeignKey
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_merchantAddr_fkey" FOREIGN KEY ("merchantAddr") REFERENCES "Merchant"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_vaultAddr_fkey" FOREIGN KEY ("vaultAddr") REFERENCES "Vault"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEvent" ADD CONSTRAINT "VaultEvent_vaultAddr_fkey" FOREIGN KEY ("vaultAddr") REFERENCES "Vault"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneRecord" ADD CONSTRAINT "MilestoneRecord_vaultAddr_fkey" FOREIGN KEY ("vaultAddr") REFERENCES "Vault"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
