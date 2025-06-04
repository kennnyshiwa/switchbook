-- CreateTable
CREATE TABLE "ForceCurvePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "switchName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "selectedFolder" TEXT NOT NULL,
    "selectedUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForceCurvePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForceCurvePreference_userId_switchName_manufacturer_key" ON "ForceCurvePreference"("userId", "switchName", "manufacturer");

-- AddForeignKey
ALTER TABLE "ForceCurvePreference" ADD CONSTRAINT "ForceCurvePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
