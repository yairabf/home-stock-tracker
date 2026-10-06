-- AlterTable
ALTER TABLE "StockProjection" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StockAdviceAttempt" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "taskVersion" TEXT NOT NULL,
    "configuredModel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "applicationStatus" TEXT NOT NULL DEFAULT 'not_applied',
    "response" JSONB,
    "resolvedModel" TEXT,
    "confidence" DOUBLE PRECISION,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "appliedPredictionId" TEXT,

    CONSTRAINT "StockAdviceAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockAdviceAttempt_productId_createdAt_idx" ON "StockAdviceAttempt"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdviceAttempt_productId_fingerprint_key" ON "StockAdviceAttempt"("productId", "fingerprint");

-- AddForeignKey
ALTER TABLE "StockAdviceAttempt" ADD CONSTRAINT "StockAdviceAttempt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdviceAttempt" ADD CONSTRAINT "StockAdviceAttempt_appliedPredictionId_fkey" FOREIGN KEY ("appliedPredictionId") REFERENCES "Prediction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
