-- Step 1: Copy imageUrl from Switch table to SwitchImage table
INSERT INTO "SwitchImage" ("id", "switchId", "url", "type", "order", "uploadedAt")
SELECT 
    gen_random_uuid(),
    "id",
    "imageUrl",
    'LINKED'::"ImageType",
    0,
    NOW()
FROM "Switch"
WHERE "imageUrl" IS NOT NULL AND "imageUrl" != '';

-- Step 2: Update Switch table to set primaryImageId for switches that had imageUrl
UPDATE "Switch" s
SET "primaryImageId" = si."id"
FROM "SwitchImage" si
WHERE s."id" = si."switchId" 
  AND si."order" = 0
  AND si."type" = 'LINKED'
  AND s."imageUrl" IS NOT NULL 
  AND s."imageUrl" != '';

-- Step 3: Copy imageUrl from MasterSwitch table to SwitchImage table
INSERT INTO "SwitchImage" ("id", "masterSwitchId", "url", "type", "order", "uploadedAt")
SELECT 
    gen_random_uuid(),
    "id",
    "imageUrl",
    'LINKED'::"ImageType",
    0,
    NOW()
FROM "MasterSwitch"
WHERE "imageUrl" IS NOT NULL AND "imageUrl" != '';

-- Step 4: Update MasterSwitch table to set primaryImageId for master switches that had imageUrl
UPDATE "MasterSwitch" ms
SET "primaryImageId" = si."id"
FROM "SwitchImage" si
WHERE ms."id" = si."masterSwitchId" 
  AND si."order" = 0
  AND si."type" = 'LINKED'
  AND ms."imageUrl" IS NOT NULL 
  AND ms."imageUrl" != '';

-- Step 5: Drop the imageUrl columns
ALTER TABLE "Switch" DROP COLUMN "imageUrl";
ALTER TABLE "MasterSwitch" DROP COLUMN "imageUrl";