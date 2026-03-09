-- CreateIndex: add unique constraint on (from, nonce) for OraclePayment
-- This prevents duplicate nonce assignment race conditions (BUG-022)
DROP INDEX IF EXISTS "OraclePayment_from_nonce_idx";
CREATE UNIQUE INDEX "OraclePayment_from_nonce_key" ON "OraclePayment"("from", "nonce");
