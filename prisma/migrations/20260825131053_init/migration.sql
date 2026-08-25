-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('fast_consumable', 'pantry_staple', 'household_consumable', 'discrete_consumable');

-- CreateEnum
CREATE TYPE "GroceryItemStatus" AS ENUM ('pending', 'purchased', 'removed');

-- CreateEnum
CREATE TYPE "GroceryItemSource" AS ENUM ('hermes_whatsapp', 'api');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "typicalUnit" TEXT,
    "productType" "ProductType",
    "isPerishable" BOOLEAN NOT NULL DEFAULT false,
    "predictionStrategy" TEXT,
    "predictionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryListItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedQuantity" DOUBLE PRECISION,
    "unit" TEXT,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "GroceryItemStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "source" "GroceryItemSource" NOT NULL DEFAULT 'api',

    CONSTRAINT "GroceryListItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GroceryListItem" ADD CONSTRAINT "GroceryListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
