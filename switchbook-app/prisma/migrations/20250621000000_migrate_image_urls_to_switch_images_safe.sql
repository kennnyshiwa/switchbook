-- Step 1: Copy imageUrl from Switch table to SwitchImage table (only if not already exists)
INSERT INTO "SwitchImage" ("id", "switchId", "url", "type", "order", "uploadedAt")
SELECT 
    gen_random_uuid(),
    s."id",
    s."imageUrl",
    'LINKED'::"ImageType",
    0,
    NOW()
FROM "Switch" s
WHERE s."imageUrl" IS NOT NULL 
  AND s."imageUrl" != ''
  AND NOT EXISTS (
    SELECT 1 
    FROM "SwitchImage" si 
    WHERE si."switchId" = s."id" 
      AND si."url" = s."imageUrl"
  );

-- Step 2: Update Switch table to set primaryImageId for switches that had imageUrl
UPDATE "Switch" s
SET "primaryImageId" = si."id"
FROM "SwitchImage" si
WHERE s."id" = si."switchId" 
  AND si."order" = 0
  AND si."type" = 'LINKED'
  AND s."imageUrl" IS NOT NULL 
  AND s."imageUrl" != ''
  AND s."primaryImageId" IS NULL
  AND si."url" = s."imageUrl";

-- Step 3: Copy imageUrl from MasterSwitch table to SwitchImage table (only if not already exists)
INSERT INTO "SwitchImage" ("id", "masterSwitchId", "url", "type", "order", "uploadedAt")
SELECT 
    gen_random_uuid(),
    ms."id",
    ms."imageUrl",
    'LINKED'::"ImageType",
    0,
    NOW()
FROM "MasterSwitch" ms
WHERE ms."imageUrl" IS NOT NULL 
  AND ms."imageUrl" != ''
  AND NOT EXISTS (
    SELECT 1 
    FROM "SwitchImage" si 
    WHERE si."masterSwitchId" = ms."id" 
      AND si."url" = ms."imageUrl"
  );

-- Step 4: Update MasterSwitch table to set primaryImageId for master switches that had imageUrl
UPDATE "MasterSwitch" ms
SET "primaryImageId" = si."id"
FROM "SwitchImage" si
WHERE ms."id" = si."masterSwitchId" 
  AND si."order" = 0
  AND si."type" = 'LINKED'
  AND ms."imageUrl" IS NOT NULL 
  AND ms."imageUrl" != ''
  AND ms."primaryImageId" IS NULL
  AND si."url" = ms."imageUrl";

-- Step 5: Drop the imageUrl columns
-- Note: Only drop these columns if you're sure all data has been migrated
-- ALTER TABLE "Switch" DROP COLUMN "imageUrl";
-- ALTER TABLE "MasterSwitch" DROP COLUMN "imageUrl";