-- Add unique constraint to MilestoneRecord for indexer upsert support
CREATE UNIQUE INDEX IF NOT EXISTS "MilestoneRecord_vaultAddr_milestoneId_key"
  ON "MilestoneRecord"("vaultAddr", "milestoneId");
