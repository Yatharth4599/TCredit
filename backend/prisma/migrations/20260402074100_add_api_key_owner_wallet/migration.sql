-- Add optional owner wallet binding for API keys (BUG-104)
ALTER TABLE "ApiKey"
ADD COLUMN IF NOT EXISTS "ownerWallet" TEXT;
