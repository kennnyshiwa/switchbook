-- CreateEnum
CREATE TYPE "ImageType" AS ENUM ('UPLOADED', 'LINKED');

-- AlterTable
ALTER TABLE "MasterSwitch" ADD COLUMN     "primaryImageId" TEXT;

-- AlterTable
ALTER TABLE "Switch" ADD COLUMN     "personalNotes" TEXT,
ADD COLUMN     "primaryImageId" TEXT;

-- CreateTable
CREATE TABLE "SwitchImage" (
    "id" TEXT NOT NULL,
    "switchId" TEXT,
    "masterSwitchId" TEXT,
    "url" TEXT NOT NULL,
    "type" "ImageType" NOT NULL DEFAULT 'UPLOADED',
    "order" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwitchImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SwitchImage_switchId_idx" ON "SwitchImage"("switchId");

-- CreateIndex
CREATE INDEX "SwitchImage_masterSwitchId_idx" ON "SwitchImage"("masterSwitchId");

-- CreateIndex
CREATE INDEX "SwitchImage_order_idx" ON "SwitchImage"("order");

-- AddForeignKey
ALTER TABLE "SwitchImage" ADD CONSTRAINT "SwitchImage_switchId_fkey" FOREIGN KEY ("switchId") REFERENCES "Switch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwitchImage" ADD CONSTRAINT "SwitchImage_masterSwitchId_fkey" FOREIGN KEY ("masterSwitchId") REFERENCES "MasterSwitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
