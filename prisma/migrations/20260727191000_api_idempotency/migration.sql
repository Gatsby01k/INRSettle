CREATE TABLE "ApiIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiCredentialId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiIdempotencyRecord_apiCredentialId_route_key_key"
ON "ApiIdempotencyRecord"("apiCredentialId", "route", "key");

CREATE INDEX "ApiIdempotencyRecord_organizationId_createdAt_idx"
ON "ApiIdempotencyRecord"("organizationId", "createdAt");

CREATE INDEX "ApiIdempotencyRecord_expiresAt_idx"
ON "ApiIdempotencyRecord"("expiresAt");

ALTER TABLE "ApiIdempotencyRecord"
ADD CONSTRAINT "ApiIdempotencyRecord_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiIdempotencyRecord"
ADD CONSTRAINT "ApiIdempotencyRecord_apiCredentialId_fkey"
FOREIGN KEY ("apiCredentialId") REFERENCES "ApiCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
