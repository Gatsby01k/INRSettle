CREATE TYPE "DueDiligenceSubjectType" AS ENUM ('CLIENT', 'PROVIDER');
CREATE TYPE "DueDiligenceStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "RiskRating" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "DueDiligenceCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subjectType" "DueDiligenceSubjectType" NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "status" "DueDiligenceStatus" NOT NULL DEFAULT 'DRAFT',
    "riskRating" "RiskRating",
    "evidenceSummary" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DueDiligenceCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DueDiligenceCase_organizationId_subjectType_subjectRef_key"
ON "DueDiligenceCase"("organizationId", "subjectType", "subjectRef");

CREATE INDEX "DueDiligenceCase_organizationId_status_updatedAt_idx"
ON "DueDiligenceCase"("organizationId", "status", "updatedAt");

CREATE INDEX "DueDiligenceCase_organizationId_subjectType_legalName_idx"
ON "DueDiligenceCase"("organizationId", "subjectType", "legalName");

ALTER TABLE "DueDiligenceCase"
ADD CONSTRAINT "DueDiligenceCase_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DueDiligenceCase"
ADD CONSTRAINT "DueDiligenceCase_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DueDiligenceCase"
ADD CONSTRAINT "DueDiligenceCase_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
