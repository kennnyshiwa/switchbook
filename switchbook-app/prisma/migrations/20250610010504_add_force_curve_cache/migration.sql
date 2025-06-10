-- CreateTable
CREATE TABLE "ForceCurveCache" (
    "id" TEXT NOT NULL,
    "switchName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "hasForceCurve" BOOLEAN NOT NULL,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForceCurveCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForceCurveCache_switchName_manufacturer_key" ON "ForceCurveCache"("switchName", "manufacturer");
