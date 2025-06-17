-- CreateEnum
CREATE TYPE "MasterSwitchStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Switch" ADD COLUMN     "isModified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "masterSwitchId" TEXT,
ADD COLUMN     "masterSwitchVersion" INTEGER,
ADD COLUMN     "modifiedFields" JSONB;

-- CreateTable
CREATE TABLE "MasterSwitch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chineseName" TEXT,
    "type" "SwitchType",
    "technology" "SwitchTechnology",
    "magnetOrientation" TEXT,
    "magnetPosition" TEXT,
    "magnetPolarity" TEXT,
    "initialForce" DOUBLE PRECISION,
    "initialMagneticFlux" DOUBLE PRECISION,
    "bottomOutMagneticFlux" DOUBLE PRECISION,
    "pcbThickness" TEXT,
    "compatibility" TEXT,
    "springWeight" TEXT,
    "springLength" TEXT,
    "actuationForce" DOUBLE PRECISION,
    "bottomOutForce" DOUBLE PRECISION,
    "preTravel" DOUBLE PRECISION,
    "bottomOut" DOUBLE PRECISION,
    "manufacturer" TEXT,
    "notes" TEXT,
    "imageUrl" TEXT,
    "topHousing" TEXT,
    "bottomHousing" TEXT,
    "stem" TEXT,
    "frankenTop" TEXT,
    "frankenBottom" TEXT,
    "frankenStem" TEXT,
    "submittedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "MasterSwitchStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalSubmissionData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterSwitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterSwitchEdit" (
    "id" TEXT NOT NULL,
    "masterSwitchId" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "previousData" JSONB NOT NULL,
    "newData" JSONB NOT NULL,
    "changedFields" JSONB NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "status" "MasterSwitchStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,

    CONSTRAINT "MasterSwitchEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterSwitch_name_manufacturer_idx" ON "MasterSwitch"("name", "manufacturer");

-- CreateIndex
CREATE INDEX "MasterSwitch_status_idx" ON "MasterSwitch"("status");

-- CreateIndex
CREATE INDEX "MasterSwitch_submittedById_idx" ON "MasterSwitch"("submittedById");

-- CreateIndex
CREATE INDEX "MasterSwitchEdit_masterSwitchId_idx" ON "MasterSwitchEdit"("masterSwitchId");

-- CreateIndex
CREATE INDEX "MasterSwitchEdit_editedById_idx" ON "MasterSwitchEdit"("editedById");

-- CreateIndex
CREATE INDEX "MasterSwitchEdit_status_idx" ON "MasterSwitchEdit"("status");

-- AddForeignKey
ALTER TABLE "Switch" ADD CONSTRAINT "Switch_masterSwitchId_fkey" FOREIGN KEY ("masterSwitchId") REFERENCES "MasterSwitch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterSwitch" ADD CONSTRAINT "MasterSwitch_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterSwitch" ADD CONSTRAINT "MasterSwitch_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterSwitchEdit" ADD CONSTRAINT "MasterSwitchEdit_masterSwitchId_fkey" FOREIGN KEY ("masterSwitchId") REFERENCES "MasterSwitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterSwitchEdit" ADD CONSTRAINT "MasterSwitchEdit_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterSwitchEdit" ADD CONSTRAINT "MasterSwitchEdit_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
