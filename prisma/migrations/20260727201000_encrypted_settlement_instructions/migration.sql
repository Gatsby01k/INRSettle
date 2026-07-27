CREATE TABLE "SettlementExecutionInstruction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "payloadCiphertext" TEXT NOT NULL,
  "payloadVersion" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementExecutionInstruction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementExecutionInstruction_settlementId_key"
  ON "SettlementExecutionInstruction"("settlementId");
CREATE INDEX "SettlementExecutionInstruction_organizationId_updatedAt_idx"
  ON "SettlementExecutionInstruction"("organizationId", "updatedAt");

ALTER TABLE "SettlementExecutionInstruction"
  ADD CONSTRAINT "SettlementExecutionInstruction_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementExecutionInstruction"
  ADD CONSTRAINT "SettlementExecutionInstruction_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementExecutionInstruction"
  ADD CONSTRAINT "SettlementExecutionInstruction_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
