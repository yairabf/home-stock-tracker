CREATE TABLE "StockProductConfirmation" (
    "operationId" TEXT NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockProductConfirmation_pkey" PRIMARY KEY ("operationId")
);
