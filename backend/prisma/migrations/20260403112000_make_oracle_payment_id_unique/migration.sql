-- Enforce global idempotency for oracle payments by paymentId
CREATE UNIQUE INDEX IF NOT EXISTS "OraclePayment_paymentId_key"
ON "OraclePayment"("paymentId");
