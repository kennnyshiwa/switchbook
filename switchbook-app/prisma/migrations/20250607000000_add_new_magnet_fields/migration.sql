-- AlterTable
ALTER TABLE "Switch" ADD COLUMN "initialForce" DOUBLE PRECISION;
ALTER TABLE "Switch" ADD COLUMN "totalTravel" DOUBLE PRECISION;
ALTER TABLE "Switch" ADD COLUMN "initialMagneticFlux" DOUBLE PRECISION;
ALTER TABLE "Switch" ADD COLUMN "bottomOutMagneticFlux" DOUBLE PRECISION;

-- Copy data from magnetStrength to initialMagneticFlux (if needed)
UPDATE "Switch" SET "initialMagneticFlux" = "magnetStrength" WHERE "magnetStrength" IS NOT NULL;

-- Drop the old column
ALTER TABLE "Switch" DROP COLUMN "magnetStrength";