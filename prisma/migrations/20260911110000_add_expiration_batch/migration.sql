CREATE TABLE "ExpirationBatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseEventId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,

    CONSTRAINT "ExpirationBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpirationBatch_purchaseEventId_key" ON "ExpirationBatch"("purchaseEventId");
CREATE INDEX "ExpirationBatch_productId_expiresAt_idx" ON "ExpirationBatch"("productId", "expiresAt");

ALTER TABLE "ExpirationBatch" ADD CONSTRAINT "ExpirationBatch_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExpirationBatch" ADD CONSTRAINT "ExpirationBatch_purchaseEventId_fkey"
FOREIGN KEY ("purchaseEventId") REFERENCES "InventoryEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
