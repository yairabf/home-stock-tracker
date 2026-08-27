-- CreateTable
CREATE TABLE "LlmInferenceLog" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT,
    "modelProvider" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "promptVersion" TEXT,
    "structuredResponse" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmInferenceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmInferenceLog_predictionId_idx" ON "LlmInferenceLog"("predictionId");

-- CreateIndex
CREATE INDEX "LlmInferenceLog_timestamp_idx" ON "LlmInferenceLog"("timestamp");

-- AddForeignKey
ALTER TABLE "LlmInferenceLog" ADD CONSTRAINT "LlmInferenceLog_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
