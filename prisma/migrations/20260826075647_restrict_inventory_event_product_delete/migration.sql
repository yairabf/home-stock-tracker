-- DropForeignKey
ALTER TABLE "InventoryEvent" DROP CONSTRAINT "InventoryEvent_productId_fkey";

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
