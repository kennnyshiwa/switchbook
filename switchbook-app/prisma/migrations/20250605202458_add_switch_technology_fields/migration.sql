-- CreateEnum
CREATE TYPE "SwitchTechnology" AS ENUM ('MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE');

-- AlterTable
ALTER TABLE "Switch" ADD COLUMN     "compatibility" TEXT,
ADD COLUMN     "magnetOrientation" TEXT,
ADD COLUMN     "technology" "SwitchTechnology";
