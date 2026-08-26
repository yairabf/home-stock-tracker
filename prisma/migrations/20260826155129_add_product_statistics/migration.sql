-- CreateTable
CREATE TABLE "ProductStatistics" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "avgPurchaseIntervalDays" DOUBLE PRECISION,
    "avgNeedIntervalDays" DOUBLE PRECISION,
    "typicalPurchaseQuantity" DOUBLE PRECISION,
    "estimatedConsumptionIntervalDays" DOUBLE PRECISION,
    "predictionAccuracy" DOUBLE PRECISION,
    "lastPurchaseAt" TIMESTAMP(3),
    "lastLowStockSignalAt" TIMESTAMP(3),
    "lastStockConfirmationAt" TIMESTAMP(3),
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStatistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductStatistics_productId_key" ON "ProductStatistics"("productId");

-- CreateIndex
CREATE INDEX "ProductStatistics_productId_idx" ON "ProductStatistics"("productId");

-- AddForeignKey
ALTER TABLE "ProductStatistics" ADD CONSTRAINT "ProductStatistics_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
