-- Universal provider integration foundation. Provider-specific payloads stay
-- inside connectors; this ledger stores connection metadata, idempotent
-- operations, durable webhook inbox rows and settlement funding visibility.

CREATE TYPE "ProviderConnectionStatus" AS ENUM (
  'DISABLED', 'CONFIGURING', 'SANDBOX_READY', 'PILOT_READY', 'SUSPENDED'
);
CREATE TYPE "ProviderOperationType" AS ENUM (
  'FUNDING_REQUEST', 'EXECUTION', 'STATUS_CHECK', 'REVERSAL', 'RECONCILIATION'
);
CREATE TYPE "ProviderOperationStatus" AS ENUM (
  'PENDING', 'IN_FLIGHT', 'SUCCEEDED', 'FAILED', 'REVIEW_REQUIRED'
);
CREATE TYPE "ProviderWebhookStatus" AS ENUM (
  'RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'
);
CREATE TYPE "FundingStatus" AS ENUM (
  'NOT_REQUIRED', 'REQUESTED', 'ACKNOWLEDGED', 'PARTIALLY_FUNDED', 'FUNDED', 'FAILED', 'CANCELLED'
);

ALTER TABLE "Settlement"
  ADD COLUMN "fundingStatus" "FundingStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "fundingRequired" DECIMAL(20,6),
  ADD COLUMN "fundedAmount" DECIMAL(20,6),
  ADD COLUMN "fundingCurrency" TEXT,
  ADD COLUMN "providerConnectionId" TEXT;

ALTER TABLE "ProviderProof" ADD COLUMN "dedupeKey" TEXT;

CREATE TABLE "ProviderConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "providerCode" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "ProviderConnectionStatus" NOT NULL DEFAULT 'CONFIGURING',
  "credentialsRef" TEXT,
  "configuration" JSONB,
  "capabilities" JSONB,
  "lastHealthAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderOperation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "settlementId" TEXT,
  "providerConnectionId" TEXT,
  "providerCode" TEXT NOT NULL,
  "operationType" "ProviderOperationType" NOT NULL,
  "status" "ProviderOperationStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "providerReference" TEXT,
  "requestSummary" JSONB,
  "responseSummary" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderWebhookEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "providerConnectionId" TEXT,
  "providerCode" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "signatureValid" BOOLEAN NOT NULL,
  "status" "ProviderWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "payloadHash" TEXT NOT NULL,
  "payload" JSONB,
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderConnection_organizationId_providerCode_key"
  ON "ProviderConnection"("organizationId", "providerCode");
CREATE INDEX "ProviderConnection_organizationId_status_idx"
  ON "ProviderConnection"("organizationId", "status");

CREATE UNIQUE INDEX "ProviderOperation_organizationId_providerCode_idempotencyKey_key"
  ON "ProviderOperation"("organizationId", "providerCode", "idempotencyKey");
CREATE INDEX "ProviderOperation_organizationId_status_createdAt_idx"
  ON "ProviderOperation"("organizationId", "status", "createdAt");
CREATE INDEX "ProviderOperation_settlementId_createdAt_idx"
  ON "ProviderOperation"("settlementId", "createdAt");
CREATE INDEX "ProviderOperation_providerCode_providerReference_idx"
  ON "ProviderOperation"("providerCode", "providerReference");

CREATE UNIQUE INDEX "ProviderWebhookEvent_providerCode_eventKey_key"
  ON "ProviderWebhookEvent"("providerCode", "eventKey");
CREATE INDEX "ProviderWebhookEvent_organizationId_receivedAt_idx"
  ON "ProviderWebhookEvent"("organizationId", "receivedAt");
CREATE INDEX "ProviderWebhookEvent_providerCode_status_receivedAt_idx"
  ON "ProviderWebhookEvent"("providerCode", "status", "receivedAt");

CREATE UNIQUE INDEX "ProviderProof_dedupeKey_key" ON "ProviderProof"("dedupeKey");
CREATE INDEX "Settlement_providerConnectionId_idx" ON "Settlement"("providerConnectionId");

ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderOperation" ADD CONSTRAINT "ProviderOperation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderOperation" ADD CONSTRAINT "ProviderOperation_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderOperation" ADD CONSTRAINT "ProviderOperation_providerConnectionId_fkey"
  FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderWebhookEvent" ADD CONSTRAINT "ProviderWebhookEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderWebhookEvent" ADD CONSTRAINT "ProviderWebhookEvent_providerConnectionId_fkey"
  FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_providerConnectionId_fkey"
  FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
