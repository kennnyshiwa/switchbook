-- CreateTable
CREATE TABLE "ForceCurveFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "switchName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "incorrectMatch" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "suggestedMatch" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForceCurveFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForceCurveFeedback_switchName_manufacturer_idx" ON "ForceCurveFeedback"("switchName", "manufacturer");

-- AddForeignKey
ALTER TABLE "ForceCurveFeedback" ADD CONSTRAINT "ForceCurveFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
