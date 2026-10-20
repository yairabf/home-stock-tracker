CREATE TABLE "AssistedActionReceipt" (
    "requestId" UUID NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "operation" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssistedActionReceipt_pkey" PRIMARY KEY ("requestId"),
    CONSTRAINT "AssistedActionReceipt_operation_check"
      CHECK ("operation" IN ('grocery_add', 'stock_set', 'purchase'))
);
