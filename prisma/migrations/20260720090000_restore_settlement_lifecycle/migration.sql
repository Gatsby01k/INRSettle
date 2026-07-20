-- Restore the lifecycle used by the current Prisma schema and application.
--
-- 20260602102000_canonical_settlement_lifecycle collapsed the enum to CREATED,
-- APPROVED, EXECUTING, SETTLED and RECONCILED. The application subsequently
-- returned to REQUESTED and restored explicit exception/terminal states without
-- a matching migration. A fresh `prisma migrate deploy` therefore produced a
-- database that could not accept the application's default REQUESTED value.
--
-- Preserve existing rows by mapping CREATED -> REQUESTED, then rebuild the enum
-- to exactly match prisma/schema.prisma. No settlement row is deleted.
ALTER TABLE "Settlement" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Settlement" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "SettlementEvent" ALTER COLUMN "fromStatus" TYPE TEXT USING "fromStatus"::TEXT;
ALTER TABLE "SettlementEvent" ALTER COLUMN "toStatus" TYPE TEXT USING "toStatus"::TEXT;

UPDATE "Settlement" SET "status" = 'REQUESTED' WHERE "status" = 'CREATED';
UPDATE "SettlementEvent" SET "fromStatus" = 'REQUESTED' WHERE "fromStatus" = 'CREATED';
UPDATE "SettlementEvent" SET "toStatus" = 'REQUESTED' WHERE "toStatus" = 'CREATED';

DROP TYPE "SettlementStatus";
CREATE TYPE "SettlementStatus" AS ENUM (
  'REQUESTED',
  'QUOTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTING',
  'SETTLED',
  'RECONCILED',
  'FAILED',
  'CANCELLED',
  'ON_HOLD'
);

ALTER TABLE "Settlement"
  ALTER COLUMN "status" TYPE "SettlementStatus" USING "status"::"SettlementStatus";
ALTER TABLE "SettlementEvent"
  ALTER COLUMN "fromStatus" TYPE "SettlementStatus" USING "fromStatus"::"SettlementStatus";
ALTER TABLE "SettlementEvent"
  ALTER COLUMN "toStatus" TYPE "SettlementStatus" USING "toStatus"::"SettlementStatus";
ALTER TABLE "Settlement" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

-- A quote is single-use. Refuse to add the guard if historical data already
-- contains multiple settlements for the same quote; those rows require an
-- explicit operator decision instead of silent deletion.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Settlement"
    WHERE "quoteId" IS NOT NULL
    GROUP BY "quoteId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce single-use quotes: duplicate Settlement.quoteId values exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX "Settlement_quoteId_key" ON "Settlement"("quoteId");

-- Provider transaction references must identify one settlement within one
-- connector. This prevents webhook routing through an arbitrary findFirst row.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Settlement"
    WHERE "provider" IS NOT NULL AND "providerTransactionId" IS NOT NULL
    GROUP BY "provider", "providerTransactionId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce provider transaction uniqueness: duplicate provider/reference pairs exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX "Settlement_provider_providerTransactionId_key"
  ON "Settlement"("provider", "providerTransactionId");
