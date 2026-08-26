-- CreateEnum
CREATE TYPE "InventoryEventType" AS ENUM ('GROCERY_ADDED', 'GROCERY_REMOVED', 'PURCHASED', 'RESTOCKED', 'STOCK_LOW', 'STOCK_OUT', 'STOCK_CONFIRMED', 'STOCK_CORRECTED', 'PREDICTION_ACCEPTED', 'PREDICTION_REJECTED', 'INFERRED_LOW_STOCK');

-- CreateTable
CREATE TABLE "InventoryEvent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "eventType" "InventoryEventType" NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "InventoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryEvent_productId_idx" ON "InventoryEvent"("productId");

-- CreateIndex
CREATE INDEX "InventoryEvent_eventType_idx" ON "InventoryEvent"("eventType");

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
