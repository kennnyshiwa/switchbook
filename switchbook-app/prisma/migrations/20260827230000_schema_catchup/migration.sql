-- Guarded reconciliation for schema objects that existed in the Prisma model
-- before they were represented in the historical migration chain.  Production
-- already contains some or all of these objects, so every operation is safe to
-- repeat and correct objects are left untouched.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClickType' AND typnamespace = current_schema()::regnamespace) THEN
    CREATE TYPE "ClickType" AS ENUM ('CLICK_LEAF', 'CLICK_BAR', 'CLICK_JACKET');
  END IF;
END $$;

ALTER TABLE "ForceCurveCatalogEntry"
  ADD COLUMN IF NOT EXISTS "metadataVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "metadataVerifiedById" TEXT;

ALTER TABLE "MasterSwitch"
  ADD COLUMN IF NOT EXISTS "bottomHousingColor" TEXT,
  ADD COLUMN IF NOT EXISTS "clickType" "ClickType",
  ADD COLUMN IF NOT EXISTS "doubleStage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "markings" TEXT,
  ADD COLUMN IF NOT EXISTS "progressiveSpring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stemColor" TEXT,
  ADD COLUMN IF NOT EXISTS "stemShape" TEXT,
  ADD COLUMN IF NOT EXISTS "tactileForce" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "tactilePosition" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "topHousingColor" TEXT;

ALTER TABLE "Switch"
  ADD COLUMN IF NOT EXISTS "bottomHousingColor" TEXT,
  ADD COLUMN IF NOT EXISTS "clickType" "ClickType",
  ADD COLUMN IF NOT EXISTS "doubleStage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "markings" TEXT,
  ADD COLUMN IF NOT EXISTS "personalTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "progressiveSpring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "shareableId" TEXT,
  ADD COLUMN IF NOT EXISTS "stemColor" TEXT,
  ADD COLUMN IF NOT EXISTS "stemShape" TEXT,
  ADD COLUMN IF NOT EXISTS "tactileForce" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "tactilePosition" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "topHousingColor" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailMarketing" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "SwitchScoreFeedback" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "switchName" TEXT NOT NULL,
  "manufacturer" TEXT, "incorrectMatch" TEXT NOT NULL, "feedbackType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SwitchScoreFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterSwitchView" (
  "id" TEXT NOT NULL, "masterSwitchId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterSwitchView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Wishlist" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "masterSwitchId" TEXT,
  "customName" TEXT, "customManufacturer" TEXT, "customNotes" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Material" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StemShape" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StemShape_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SwitchScoreFeedback_userId_idx" ON "SwitchScoreFeedback"("userId");
CREATE INDEX IF NOT EXISTS "SwitchScoreFeedback_switchName_manufacturer_idx" ON "SwitchScoreFeedback"("switchName", "manufacturer");
CREATE UNIQUE INDEX IF NOT EXISTS "SwitchScoreFeedback_switchName_manufacturer_incorrectMatch_key" ON "SwitchScoreFeedback"("switchName", "manufacturer", "incorrectMatch");
CREATE INDEX IF NOT EXISTS "MasterSwitchView_masterSwitchId_idx" ON "MasterSwitchView"("masterSwitchId");
CREATE INDEX IF NOT EXISTS "MasterSwitchView_userId_idx" ON "MasterSwitchView"("userId");
CREATE INDEX IF NOT EXISTS "MasterSwitchView_viewedAt_idx" ON "MasterSwitchView"("viewedAt");
CREATE INDEX IF NOT EXISTS "Wishlist_userId_idx" ON "Wishlist"("userId");
CREATE INDEX IF NOT EXISTS "Wishlist_masterSwitchId_idx" ON "Wishlist"("masterSwitchId");
CREATE UNIQUE INDEX IF NOT EXISTS "Wishlist_userId_masterSwitchId_key" ON "Wishlist"("userId", "masterSwitchId");
CREATE UNIQUE INDEX IF NOT EXISTS "Material_name_key" ON "Material"("name");
CREATE INDEX IF NOT EXISTS "Material_active_idx" ON "Material"("active");
CREATE INDEX IF NOT EXISTS "Material_order_idx" ON "Material"("order");
CREATE UNIQUE INDEX IF NOT EXISTS "StemShape_name_key" ON "StemShape"("name");
CREATE INDEX IF NOT EXISTS "StemShape_active_idx" ON "StemShape"("active");
CREATE INDEX IF NOT EXISTS "StemShape_order_idx" ON "StemShape"("order");
CREATE UNIQUE INDEX IF NOT EXISTS "Switch_shareableId_key" ON "Switch"("shareableId");

-- The current model permits a photo without a source URL. Dropping NOT NULL is
-- data-preserving; skip it when the column is already nullable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'PartnerSubmissionPhoto'
      AND column_name = 'sourceUrl' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "PartnerSubmissionPhoto" ALTER COLUMN "sourceUrl" DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='SwitchScoreFeedback_userId_fkey' AND conrelid='"SwitchScoreFeedback"'::regclass) THEN
    ALTER TABLE "SwitchScoreFeedback" ADD CONSTRAINT "SwitchScoreFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ForceCurveCatalogEntry_metadataVerifiedById_fkey' AND conrelid='"ForceCurveCatalogEntry"'::regclass) THEN
    ALTER TABLE "ForceCurveCatalogEntry" ADD CONSTRAINT "ForceCurveCatalogEntry_metadataVerifiedById_fkey" FOREIGN KEY ("metadataVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='MasterSwitchView_masterSwitchId_fkey' AND conrelid='"MasterSwitchView"'::regclass) THEN
    ALTER TABLE "MasterSwitchView" ADD CONSTRAINT "MasterSwitchView_masterSwitchId_fkey" FOREIGN KEY ("masterSwitchId") REFERENCES "MasterSwitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='MasterSwitchView_userId_fkey' AND conrelid='"MasterSwitchView"'::regclass) THEN
    ALTER TABLE "MasterSwitchView" ADD CONSTRAINT "MasterSwitchView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Wishlist_masterSwitchId_fkey' AND conrelid='"Wishlist"'::regclass) THEN
    ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_masterSwitchId_fkey" FOREIGN KEY ("masterSwitchId") REFERENCES "MasterSwitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Wishlist_userId_fkey' AND conrelid='"Wishlist"'::regclass) THEN
    ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- The clean historical chain has this FK with CASCADE; production already has
-- the desired SET NULL action. Replace only the demonstrably incorrect form.
DO $$
DECLARE delete_action "char";
BEGIN
  SELECT confdeltype INTO delete_action FROM pg_constraint
    WHERE conname='SwitchImage_switchId_fkey' AND conrelid='"SwitchImage"'::regclass;
  IF delete_action IS NULL THEN
    ALTER TABLE "SwitchImage" ADD CONSTRAINT "SwitchImage_switchId_fkey" FOREIGN KEY ("switchId") REFERENCES "Switch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ELSIF delete_action <> 'n' THEN
    ALTER TABLE "SwitchImage" DROP CONSTRAINT "SwitchImage_switchId_fkey";
    ALTER TABLE "SwitchImage" ADD CONSTRAINT "SwitchImage_switchId_fkey" FOREIGN KEY ("switchId") REFERENCES "Switch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
