-- Make VaultEvent.vaultAddr nullable (for non-vault events)
ALTER TABLE "VaultEvent" ALTER COLUMN "vaultAddr" DROP NOT NULL;

-- Drop old FK constraint (will be recreated as optional)
ALTER TABLE "VaultEvent" DROP CONSTRAINT IF EXISTS "VaultEvent_vaultAddr_fkey";

-- Add logIndex column for deduplication
ALTER TABLE "VaultEvent" ADD COLUMN IF NOT EXISTS "logIndex" INTEGER NOT NULL DEFAULT 0;

-- Add unique constraint to prevent duplicate event ingestion
CREATE UNIQUE INDEX IF NOT EXISTS "VaultEvent_txHash_logIndex_key" ON "VaultEvent"("txHash", "logIndex");

-- Add composite index for vault+eventType queries
CREATE INDEX IF NOT EXISTS "VaultEvent_vaultAddr_eventType_idx" ON "VaultEvent"("vaultAddr", "eventType");

-- Add index for eventType-only queries
CREATE INDEX IF NOT EXISTS "VaultEvent_eventType_idx" ON "VaultEvent"("eventType");

-- Re-add FK as optional (allow NULL vaultAddr)
ALTER TABLE "VaultEvent" ADD CONSTRAINT "VaultEvent_vaultAddr_fkey"
  FOREIGN KEY ("vaultAddr") REFERENCES "Vault"("address")
  ON DELETE SET NULL ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- Create IndexerState table
CREATE TABLE IF NOT EXISTS "IndexerState" (
  "id"        TEXT NOT NULL DEFAULT 'singleton',
  "lastBlock" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("id")
);
