-- New settlements are provider-executed operating records by default.
-- Existing records retain their mode; no historical data is rewritten.
ALTER TABLE "Settlement"
  ALTER COLUMN "test_mode" SET DEFAULT 'SHADOW';
