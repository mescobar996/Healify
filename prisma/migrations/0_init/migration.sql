-- Baseline migration. The database was originally provisioned via
-- `prisma db push` before migrations were adopted; `add_api_key_hash` was
-- the only real migration and could never replay cleanly from empty (it
-- assumes tables that only db push had created). Generated via
-- `prisma migrate diff --from-empty --to-url <live DATABASE_URL> --script`,
-- then hand-trimmed to drop the apiKeyHash/apiKeyPrefix columns and their
-- unique index — those are added by add_api_key_hash, which stays in place
-- unmodified and replays right after this one. See
-- docs/superpowers/plans/2026-07-21-healify-gate.md Task 1.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Gateway" AS ENUM ('LEMONSQUEEZY', 'MERCADOPAGO', 'STRIPE');

-- CreateEnum
CREATE TYPE "public"."HealingStatus" AS ENUM ('ANALYZING', 'HEALED_AUTO', 'HEALED_MANUAL', 'BUG_DETECTED', 'REMOVED_LEGIT', 'NEEDS_REVIEW', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "public"."Plan" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "public"."SelectorType" AS ENUM ('CSS', 'XPATH', 'TESTID', 'ROLE', 'TEXT', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."TestStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'HEALED', 'PARTIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "projectId" TEXT,
    "metadata" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."healing_events" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "testFile" TEXT,
    "failedSelector" TEXT NOT NULL,
    "selectorType" "public"."SelectorType" NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT,
    "oldDomSnapshot" TEXT,
    "newDomSnapshot" TEXT,
    "newSelector" TEXT,
    "newSelectorType" "public"."SelectorType",
    "confidence" DOUBLE PRECISION,
    "status" "public"."HealingStatus" NOT NULL DEFAULT 'ANALYZING',
    "reasoning" TEXT,
    "actionTaken" TEXT,
    "appliedAt" TIMESTAMP(3),
    "appliedBy" TEXT,
    "screenshotBefore" TEXT,
    "screenshotAfter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prBranch" TEXT,
    "prUrl" TEXT,

    CONSTRAINT "healing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repository" TEXT,
    "apiKey" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "autoHealThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "autoPrEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastScheduledAt" TIMESTAMP(3),
    "notifyOnFail" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnHeal" BOOLEAN NOT NULL DEFAULT true,
    "scheduleBranch" TEXT,
    "scheduleCron" TEXT,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."screenshots" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripePriceId" TEXT,
    "plan" "public"."Plan" NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT,
    "gateway" "public"."Gateway",
    "gatewayCustomerId" TEXT,
    "gatewaySubId" TEXT,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "trialEndsAt" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "public"."TestStatus" NOT NULL DEFAULT 'PENDING',
    "branch" TEXT,
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "passedTests" INTEGER NOT NULL DEFAULT 0,
    "failedTests" INTEGER NOT NULL DEFAULT 0,
    "healedTests" INTEGER NOT NULL DEFAULT 0,
    "jobId" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tracked_selectors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "type" "public"."SelectorType" NOT NULL,
    "file" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "element" TEXT,
    "timesUsed" INTEGER NOT NULL DEFAULT 1,
    "timesFailed" INTEGER NOT NULL DEFAULT 0,
    "timesHealed" INTEGER NOT NULL DEFAULT 0,
    "robustness" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFailed" TIMESTAMP(3),
    "lastHealed" TIMESTAMP(3),

    CONSTRAINT "tracked_selectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slackWebhookUrl" TEXT,
    "devHourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 65,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."waitlist_entries" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'pro',
    "source" TEXT NOT NULL DEFAULT 'pricing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "public"."accounts"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE INDEX "analytics_events_eventType_createdAt_idx" ON "public"."analytics_events"("eventType" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "analytics_events_projectId_idx" ON "public"."analytics_events"("projectId" ASC);

-- CreateIndex
CREATE INDEX "healing_events_status_createdAt_idx" ON "public"."healing_events"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "healing_events_status_idx" ON "public"."healing_events"("status" ASC);

-- CreateIndex
CREATE INDEX "healing_events_testRunId_idx" ON "public"."healing_events"("testRunId" ASC);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "public"."notifications"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "projects_apiKey_key" ON "public"."projects"("apiKey" ASC);

-- CreateIndex
CREATE INDEX "projects_repository_idx" ON "public"."projects"("repository" ASC);

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "public"."projects"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "public"."sessions"("sessionToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "public"."settings"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeCustomerId_key" ON "public"."subscriptions"("stripeCustomerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "public"."subscriptions"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "test_runs_jobId_key" ON "public"."test_runs"("jobId" ASC);

-- CreateIndex
CREATE INDEX "test_runs_projectId_startedAt_idx" ON "public"."test_runs"("projectId" ASC, "startedAt" ASC);

-- CreateIndex
CREATE INDEX "test_runs_status_idx" ON "public"."test_runs"("status" ASC);

-- CreateIndex
CREATE INDEX "tracked_selectors_projectId_selector_idx" ON "public"."tracked_selectors"("projectId" ASC, "selector" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "public"."verification_tokens"("identifier" ASC, "token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "public"."verification_tokens"("token" ASC);

-- CreateIndex
CREATE INDEX "waitlist_entries_createdAt_idx" ON "public"."waitlist_entries"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "waitlist_entries_email_idx" ON "public"."waitlist_entries"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_email_key" ON "public"."waitlist_entries"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."healing_events" ADD CONSTRAINT "healing_events_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "public"."test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."screenshots" ADD CONSTRAINT "screenshots_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "public"."test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_runs" ADD CONSTRAINT "test_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tracked_selectors" ADD CONSTRAINT "tracked_selectors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

