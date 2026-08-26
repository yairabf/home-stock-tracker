-- AlterTable
ALTER TABLE "GroceryListItem" ADD COLUMN     "relatedInventoryEventId" TEXT;

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "adultsCount" INTEGER NOT NULL DEFAULT 2,
    "childrenCount" INTEGER NOT NULL DEFAULT 3,
    "childAgeGroups" TEXT[],
    "predictionPreferences" JSONB,
    "suggestionConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "productPolicies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroceryListItem_status_idx" ON "GroceryListItem"("status");

-- AddForeignKey
ALTER TABLE "GroceryListItem" ADD CONSTRAINT "GroceryListItem_relatedInventoryEventId_fkey" FOREIGN KEY ("relatedInventoryEventId") REFERENCES "InventoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
