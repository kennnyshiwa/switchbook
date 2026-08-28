CREATE TABLE "ForceCurveSyncStage" (
  "id" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "outputKey" TEXT NOT NULL,
  "outputType" TEXT NOT NULL,
  "masterSwitchId" TEXT,
  "catalogEntryId" TEXT,
  "mappingState" "ForceCurveMappingState",
  "confidence" DOUBLE PRECISION,
  "provenance" TEXT,
  "reviewKind" TEXT,
  "reason" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ForceCurveSyncStage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ForceCurveSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ForceCurveSyncStage_runId_outputKey_key" ON "ForceCurveSyncStage"("runId", "outputKey");
CREATE INDEX "ForceCurveSyncStage_runId_outputType_idx" ON "ForceCurveSyncStage"("runId", "outputType");
CREATE INDEX "fc_review_dedupe_idx" ON "ForceCurveReviewCase"("catalogEntryId", "status", "kind", "masterSwitchId");
