ALTER TABLE "Switch" ADD COLUMN "quantity" INTEGER;
ALTER TABLE "Switch" ADD CONSTRAINT "Switch_quantity_nonnegative" CHECK ("quantity" IS NULL OR "quantity" >= 0);
