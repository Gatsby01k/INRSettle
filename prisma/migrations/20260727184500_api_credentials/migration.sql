CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SETTLEMENT_OPERATOR',
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiCredential_keyPrefix_key" ON "ApiCredential"("keyPrefix");
CREATE INDEX "ApiCredential_organizationId_revokedAt_createdAt_idx"
ON "ApiCredential"("organizationId", "revokedAt", "createdAt");

ALTER TABLE "ApiCredential"
ADD CONSTRAINT "ApiCredential_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiCredential"
ADD CONSTRAINT "ApiCredential_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
