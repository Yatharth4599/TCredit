-- CreateTable
CREATE TABLE IF NOT EXISTS "FaucetMint" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "lastMintAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalMinted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FaucetMint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FaucetMint_recipient_key" ON "FaucetMint"("recipient");
