-- AlterTable
ALTER TABLE "MasterSwitch" ADD COLUMN "shareableId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MasterSwitch_shareableId_key" ON "MasterSwitch"("shareableId");

-- CreateIndex
CREATE INDEX "MasterSwitch_shareableId_idx" ON "MasterSwitch"("shareableId");