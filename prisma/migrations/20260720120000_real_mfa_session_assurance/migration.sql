ALTER TABLE "User"
  ADD COLUMN "mfaSecretCiphertext" TEXT,
  ADD COLUMN "mfaPendingSecretCiphertext" TEXT,
  ADD COLUMN "mfaRecoveryCodeHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3),
  ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- The previous boolean was an illustrative enrollment marker without a secret.
-- Such rows cannot pass a real TOTP challenge, so fail closed and require a new
-- enrollment rather than preserving a misleading enabled state.
UPDATE "User"
SET "mfaEnabled" = false
WHERE "mfaEnabled" = true AND "mfaSecretCiphertext" IS NULL;
