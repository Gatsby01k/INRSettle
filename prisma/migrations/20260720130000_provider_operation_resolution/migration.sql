ALTER TYPE "ProviderOperationStatus" ADD VALUE IF NOT EXISTS 'RESOLVED_BY_STATUS';
ALTER TYPE "ProviderOperationStatus" ADD VALUE IF NOT EXISTS 'RESOLVED_NO_EFFECT';

ALTER TABLE "ProviderOperation"
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "resolvedByUserId" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE INDEX "ProviderOperation_organizationId_resolvedAt_idx"
  ON "ProviderOperation"("organizationId", "resolvedAt");
