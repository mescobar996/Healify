-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "autoHealThreshold" SET DEFAULT 0.95;

-- Backfill: autoHealThreshold existed in the schema but no code path read it
-- until this change (see docs/superpowers/specs/2026-07-21-healify-v2-complementary-tools.md §3.6).
-- Every existing row still has the original, never-enforced 0.85 default —
-- no user ever knowingly chose that value. Bringing them to 0.95 preserves
-- today's de-facto auto-heal bar instead of silently loosening it the
-- moment the threshold starts being enforced.
UPDATE "projects" SET "autoHealThreshold" = 0.95 WHERE "autoHealThreshold" = 0.85;
