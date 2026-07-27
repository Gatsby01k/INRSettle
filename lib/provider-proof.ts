import "server-only";

import crypto from "node:crypto";
import { AuditActorType, Prisma, ProofReceivedVia, type ProviderProof } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import { redactProviderPayload } from "@/lib/providers/redaction";

export type { ProviderProof };
export { ProofReceivedVia };

export type RecordProviderProofInput = {
  settlementId: string;
  organizationId: string;
  /** Actor recorded on the audit entry (settlement creator for webhooks). */
  userId: string;
  provider: string;
  providerTransactionId?: string | null;
  /** Bank UTR / external payment reference, when the provider supplies one. */
  utr?: string | null;
  providerStatus: string;
  /** The amount the provider claims was paid out, when reported. */
  actualAmount?: number | string | null;
  currency?: string | null;
  rawResponse?: unknown;
  receivedVia: ProofReceivedVia;
  actorType?: AuditActorType;
};

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(redactProviderPayload(value))) as Prisma.InputJsonValue;
}

function asDecimal(value: number | string | null | undefined): Prisma.Decimal | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return new Prisma.Decimal(num);
}

export function providerProofDedupeKey(input: Pick<
  RecordProviderProofInput,
  "settlementId" | "provider" | "providerTransactionId" | "providerStatus" | "receivedVia"
>): string {
  return crypto.createHash("sha256").update([
    input.settlementId,
    input.provider.trim().toLowerCase(),
    input.providerTransactionId?.trim() ?? "",
    input.providerStatus.trim().toLowerCase(),
    input.receivedVia,
  ].join("\u0000")).digest("hex");
}

/**
 * Persists an append-only provider proof row and writes a `provider.proof.recorded`
 * audit entry.
 *
 * Provider proof is evidence, not truth: a proof row with providerStatus
 * "completed" means the provider CLAIMS the payout completed. It never moves the
 * settlement lifecycle by itself — reconciliation against an independent source
 * and the audit trail must agree before finality review can pass (lib/finality.ts).
 *
 * IDEMPOTENT on the natural key (settlement + provider + transaction + status +
 * channel): re-delivered webhooks and repeated polls return the existing row
 * instead of duplicating evidence or audit entries. A *changed* provider status
 * is new evidence and gets its own row.
 *
 * Callers should record proof BEFORE applying any lifecycle transition so a
 * failed write leaves the settlement in a retryable state rather than settled
 * without evidence.
 */
export async function recordProviderProof(input: RecordProviderProofInput): Promise<ProviderProof> {
  const provider = input.provider.trim();
  const providerStatus = input.providerStatus.trim();
  if (!provider || !providerStatus) {
    throw new UserFacingError("Provider and provider status are required for proof.");
  }

  const dedupeKey = providerProofDedupeKey({ ...input, provider, providerStatus });

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findFirst({
      where: { id: input.settlementId, organizationId: input.organizationId },
      select: { id: true },
    });
    if (!settlement) throw new UserFacingError("Settlement was not found for this organization.");

    const duplicate = await tx.providerProof.findUnique({ where: { dedupeKey } });
    if (duplicate) return duplicate;

    const proof = await tx.providerProof.create({
      data: {
        settlementId: input.settlementId,
        provider,
        providerTransactionId: input.providerTransactionId?.trim() || null,
        utr: input.utr?.trim() || null,
        providerStatus,
        actualAmount: asDecimal(input.actualAmount),
        currency: input.currency ?? null,
        rawResponse: asJson(input.rawResponse),
        receivedVia: input.receivedVia,
        dedupeKey,
      },
    });

    await writeAuditLog({
      action: "provider.proof.recorded",
      resourceType: "provider_proof",
      resourceId: proof.id,
      organizationId: input.organizationId,
      userId: input.userId,
      actorType: input.actorType ?? AuditActorType.SYSTEM,
      after: {
        settlementId: proof.settlementId,
        provider: proof.provider,
        providerTransactionId: proof.providerTransactionId,
        utr: proof.utr,
        providerStatus: proof.providerStatus,
        actualAmount: proof.actualAmount?.toString() ?? null,
        currency: proof.currency,
        receivedVia: proof.receivedVia,
      },
    }, tx);

    return proof;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Latest proof recorded for a settlement, or null when none exists yet. */
export async function latestProviderProof(settlementId: string): Promise<ProviderProof | null> {
  return prisma.providerProof.findFirst({
    where: { settlementId },
    orderBy: { receivedAt: "desc" },
  });
}
