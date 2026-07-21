-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "autoHealThreshold" SET DEFAULT 0.95;

-- Backfill: autoHealThreshold is user-editable today via /api/projects/[id]/settings
-- (a slider on the project settings page), so this WHERE clause can't fully
-- distinguish "untouched default" from "deliberately set to 0.85" — the settings
-- form PUTs the whole config on every save, so any unrelated settings change
-- (e.g. toggling notifyOnFail) resends the current threshold too. Checked against
-- the real dataset on 2026-07-21 (see docs/superpowers/specs/2026-07-21-healify-v2-complementary-tools.md
-- §3.6): only 4 projects exist, 3 never saved settings after creation (createdAt ==
-- updatedAt) and the 4th is the developer's own test project — no evidence any row
-- was a deliberate choice. Preserves today's de-facto auto-heal bar instead of
-- silently loosening it once evaluateGate() starts enforcing this field; adjustable
-- per-project via the existing settings UI for anyone who wants 0.85 back.
UPDATE "projects" SET "autoHealThreshold" = 0.95 WHERE "autoHealThreshold" = 0.85;
