/*
  Warnings:

  - Added the required column `deadline` to the `OraclePayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `from` to the `OraclePayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentId` to the `OraclePayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `to` to the `OraclePayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OraclePayment" ADD COLUMN     "deadline" BIGINT NOT NULL,
ADD COLUMN     "from" TEXT NOT NULL,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "paymentId" TEXT NOT NULL,
ADD COLUMN     "to" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "OraclePayment_status_idx" ON "OraclePayment"("status");

-- CreateIndex
CREATE INDEX "OraclePayment_from_nonce_idx" ON "OraclePayment"("from", "nonce");
