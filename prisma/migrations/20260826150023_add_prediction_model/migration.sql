-- CreateEnum
CREATE TYPE "PredictedState" AS ENUM ('likely_available', 'probably_low', 'probably_out', 'uncertain');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "predictedState" "PredictedState" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "predictedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recommendedAction" TEXT,
    "deterministicSignals" JSONB NOT NULL,
    "llmResult" JSONB,
    "reason" TEXT NOT NULL,
    "modelProviderVersion" TEXT,
    "feedbackStatus" "FeedbackStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prediction_productId_idx" ON "Prediction"("productId");

-- CreateIndex
CREATE INDEX "Prediction_predictedAt_idx" ON "Prediction"("predictedAt");

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
