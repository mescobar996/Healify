-- Add hash-at-rest columns for API keys
-- This migration adds apiKeyHash and apiKeyPrefix to the projects table
-- so we can stop storing plaintext API keys.

-- Step 1: Add new columns (nullable to allow gradual migration)
ALTER TABLE "projects" ADD COLUMN "apiKeyHash" TEXT;
ALTER TABLE "projects" ADD COLUMN "apiKeyPrefix" TEXT;

-- Step 2: Create unique index on apiKeyHash
CREATE UNIQUE INDEX "projects_apiKeyHash_key" ON "projects"("apiKeyHash");

-- Step 3: Backfill existing keys
-- Run this ONCE after deploying the new code:
--   UPDATE "projects"
--   SET "apiKeyHash" = encode(sha256(convert_to("apiKey", 'UTF8')), 'hex'),
--       "apiKeyPrefix" = CONCAT(LEFT("apiKey", 8), '...', RIGHT("apiKey", 4))
--   WHERE "apiKeyHash" IS NULL;
--
-- Note: The application code also does lazy backfill on each API key validation,
-- so this manual step is optional but recommended for completeness.
--
-- Step 4 (future): Once all rows are backfilled and verified:
--   ALTER TABLE "projects" DROP COLUMN "apiKey";
