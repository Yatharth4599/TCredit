-- CreateTable: Solana on-chain data models for Krexa devnet deployment

CREATE TABLE IF NOT EXISTS "SolanaAgentWallet" (
    "agentPubkey" TEXT NOT NULL,
    "ownerPubkey" TEXT NOT NULL,
    "creditLevel" INTEGER NOT NULL DEFAULT 0,
    "creditDrawn" BIGINT NOT NULL DEFAULT 0,
    "creditLimit" BIGINT NOT NULL DEFAULT 0,
    "kyaTier" INTEGER NOT NULL DEFAULT 0,
    "creditScore" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolanaAgentWallet_pkey" PRIMARY KEY ("agentPubkey")
);

CREATE TABLE IF NOT EXISTS "SolanaAgentTrade" (
    "id" TEXT NOT NULL,
    "agentPubkey" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "txSignature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolanaAgentTrade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SolanaVenueWhitelist" (
    "venuePubkey" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolanaVenueWhitelist_pkey" PRIMARY KEY ("venuePubkey")
);

CREATE TABLE IF NOT EXISTS "SolanaEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "txSignature" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolanaEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SolanaIndexerState" (
    "id" TEXT NOT NULL,
    "lastSignature" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolanaIndexerState_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SolanaAgentTrade" ADD CONSTRAINT "SolanaAgentTrade_agentPubkey_fkey"
    FOREIGN KEY ("agentPubkey") REFERENCES "SolanaAgentWallet"("agentPubkey")
    ON DELETE RESTRICT ON UPDATE CASCADE;
