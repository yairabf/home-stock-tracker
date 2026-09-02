ALTER TYPE "InventoryEventType" ADD VALUE 'STOCK_SET';
ALTER TYPE "InventoryEventType" ADD VALUE 'STOCK_CONSUMED';

CREATE TYPE "ShelfLifePolicyKind" AS ENUM ('finite', 'nonperishable');

CREATE TABLE "StockProjection" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedQuantity" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedSource" TEXT NOT NULL,
    "recordedEventId" TEXT NOT NULL,
    "estimatedQuantity" DOUBLE PRECISION,
    "estimatedState" "PredictedState" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "predictionId" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockProjection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockProjection_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1),
    CONSTRAINT "StockProjection_quantities_check" CHECK (
      ("recordedQuantity" IS NULL OR "recordedQuantity" >= 0) AND
      ("estimatedQuantity" IS NULL OR "estimatedQuantity" >= 0)
    )
);

CREATE TABLE "ProductShelfLifePolicy" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "ShelfLifePolicyKind" NOT NULL,
    "shelfLifeDays" DOUBLE PRECISION,
    "modelProvider" TEXT,
    "modelVersion" TEXT,
    "promptVersion" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductShelfLifePolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductShelfLifePolicy_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1),
    CONSTRAINT "ProductShelfLifePolicy_shape_check" CHECK (
      ("kind" = 'finite' AND "shelfLifeDays" IS NOT NULL AND "shelfLifeDays" > 0) OR
      ("kind" = 'nonperishable' AND "shelfLifeDays" IS NULL)
    )
);

CREATE UNIQUE INDEX "StockProjection_productId_key" ON "StockProjection"("productId");
CREATE UNIQUE INDEX "StockProjection_recordedEventId_key" ON "StockProjection"("recordedEventId");
CREATE INDEX "StockProjection_estimatedState_idx" ON "StockProjection"("estimatedState");
CREATE INDEX "StockProjection_predictionId_idx" ON "StockProjection"("predictionId");
CREATE UNIQUE INDEX "ProductShelfLifePolicy_productId_key" ON "ProductShelfLifePolicy"("productId");

ALTER TABLE "StockProjection" ADD CONSTRAINT "StockProjection_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockProjection" ADD CONSTRAINT "StockProjection_recordedEventId_fkey"
  FOREIGN KEY ("recordedEventId") REFERENCES "InventoryEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockProjection" ADD CONSTRAINT "StockProjection_predictionId_fkey"
  FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductShelfLifePolicy" ADD CONSTRAINT "ProductShelfLifePolicy_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
