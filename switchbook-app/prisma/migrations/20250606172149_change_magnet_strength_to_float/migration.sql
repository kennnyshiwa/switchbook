/*
  Warnings:

  - The `magnetStrength` column on the `Switch` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Switch" DROP COLUMN "magnetStrength",
ADD COLUMN     "magnetStrength" DOUBLE PRECISION;
