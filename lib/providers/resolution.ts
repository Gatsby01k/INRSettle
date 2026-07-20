import "server-only";

import {
  Prisma,
  ProviderOperationStatus,
  ProviderOperationType,
  SettlementStatus,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkSettlementProviderStatus } from "@/lib/providers/service";

export const NO_EFFECT_CONFIRMATION = "NO PROVIDER SIDE EFFECT CONFIRMED";

export function validateNoEffectConfirmation(confirmation: string, note: string) {
  if (confirmation.trim() !== NO_EFFECT_CONFIRMATION) {
    throw new UserFacingError(`Type “${NO_EFFECT_CONFIRMATION}” exactly to confirm.`);
  }
  const normalizedNote = note.trim();
  if (normalizedNote.length < 12) {
    throw new UserFacingError("Resolution note must explain the external verification in at least 12 characters.");
  }
  if (normalizedNote.length > 1000) {
    throw new UserFacingError("Resolution note must not exceed 1000 characters.");
  }
  return normalizedNote;
}

/**
 * Safe recovery action: poll only. It never re-submits an execution. A final
 * settlement state closes the uncertain execution operation; pending/in-flight
 * provider state leaves it REVIEW_REQUIRED.
 */
export async function syncReviewRequiredOperation(
  operationId: string,
  userId: string,
  organizationId: string,
) {
  const operation = await prisma.providerOperation.findFirst({
    where: { id: operationId, organizationId },
  });
  if (!operation) throw new UserFacingError("Provider operation was not found.");
  if (operation.status !== ProviderOperationStatus.REVIEW_REQUIRED) {
    throw new UserFacingError("Only REVIEW_REQUIRED operations can be resolved.");
  }
  if (operation.operationType !== ProviderOperationType.EXECUTION || !operation.settlementId) {
    throw new UserFacingError("Only settlement execution operations support status recovery.");
  }

  await checkSettlementProviderStatus(operation.settlementId, userId, organizationId);

  return prisma.$transaction(async (tx) => {
    const fresh = await tx.providerOperation.findFirst({
      where: { id: operationId, organizationId },
      include: { settlement: true },
    });
    if (!fresh || fresh.status !== ProviderOperationStatus.REVIEW_REQUIRED || !fresh.settlement) {
      throw new UserFacingError("Provider operation changed while status was being checked.");
    }

    const finalStatuses: SettlementStatus[] = [
      SettlementStatus.SETTLED,
      SettlementStatus.RECONCILED,
      SettlementStatus.FAILED,
    ];
    const final = finalStatuses.includes(fresh.settlement.status);
    if (!final) {
      await writeAuditLog({
        action: "provider.operation.status_inconclusive",
        resourceType: "provider_operation",
        resourceId: fresh.id,
        organizationId,
        userId,
        after: {
          providerCode: fresh.providerCode,
          settlementStatus: fresh.settlement.status,
          providerStatus: fresh.settlement.providerStatus,
        },
      }, tx);
      return { resolved: false, status: fresh.status, settlementStatus: fresh.settlement.status };
    }

    const claimed = await tx.providerOperation.updateMany({
      where: { id: fresh.id, organizationId, status: ProviderOperationStatus.REVIEW_REQUIRED },
      data: {
        status: ProviderOperationStatus.RESOLVED_BY_STATUS,
        providerReference: fresh.settlement.providerTransactionId,
        responseSummary: {
          settlementStatus: fresh.settlement.status,
          providerStatus: fresh.settlement.providerStatus,
          resolution: "status_poll",
        },
        errorCode: null,
        errorMessage: null,
        resolutionNote: "Resolved from a final provider status poll.",
        resolvedByUserId: userId,
        resolvedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      throw new UserFacingError("Provider operation changed concurrently. Refresh and try again.");
    }
    await writeAuditLog({
      action: "provider.operation.resolved_by_status",
      resourceType: "provider_operation",
      resourceId: fresh.id,
      organizationId,
      userId,
      after: {
        providerCode: fresh.providerCode,
        settlementStatus: fresh.settlement.status,
        providerStatus: fresh.settlement.providerStatus,
        providerReference: fresh.settlement.providerTransactionId,
      },
    }, tx);
    return {
      resolved: true,
      status: ProviderOperationStatus.RESOLVED_BY_STATUS,
      settlementStatus: fresh.settlement.status,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Closes an uncertain request only after an independent operator attests that
 * the provider confirmed no side effect. The settlement is failed atomically;
 * it is never reset to APPROVED and this function never retries the payout.
 */
export async function confirmProviderOperationNoEffect(input: {
  operationId: string;
  userId: string;
  organizationId: string;
  confirmation: string;
  note: string;
}) {
  const note = validateNoEffectConfirmation(input.confirmation, input.note);

  return prisma.$transaction(async (tx) => {
    const operation = await tx.providerOperation.findFirst({
      where: { id: input.operationId, organizationId: input.organizationId },
      include: { settlement: true },
    });
    if (!operation) throw new UserFacingError("Provider operation was not found.");
    if (operation.status !== ProviderOperationStatus.REVIEW_REQUIRED) {
      throw new UserFacingError("Only REVIEW_REQUIRED operations can be resolved.");
    }
    if (operation.operationType !== ProviderOperationType.EXECUTION || !operation.settlement) {
      throw new UserFacingError("Only settlement execution operations support no-effect resolution.");
    }
    if (operation.settlement.createdById === input.userId) {
      throw new UserFacingError("The settlement creator cannot resolve an uncertain provider execution.");
    }
    if (operation.providerReference || operation.settlement.providerTransactionId) {
      throw new UserFacingError(
        "A provider reference exists. Use status sync and reconciliation; no-effect resolution is blocked.",
      );
    }
    if (
      operation.settlement.status !== SettlementStatus.APPROVED &&
      operation.settlement.status !== SettlementStatus.EXECUTING
    ) {
      throw new UserFacingError("No-effect resolution requires an APPROVED or EXECUTING settlement.");
    }

    const operationClaim = await tx.providerOperation.updateMany({
      where: {
        id: operation.id,
        organizationId: input.organizationId,
        status: ProviderOperationStatus.REVIEW_REQUIRED,
      },
      data: {
        status: ProviderOperationStatus.RESOLVED_NO_EFFECT,
        resolutionNote: note,
        resolvedByUserId: input.userId,
        resolvedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    if (operationClaim.count !== 1) {
      throw new UserFacingError("Provider operation changed concurrently. Refresh and try again.");
    }

    const settlementClaim = await tx.settlement.updateMany({
      where: {
        id: operation.settlement.id,
        organizationId: input.organizationId,
        status: operation.settlement.status,
      },
      data: {
        status: SettlementStatus.FAILED,
        failureReason: "Provider operation closed after external no-side-effect confirmation.",
      },
    });
    if (settlementClaim.count !== 1) {
      throw new UserFacingError("Settlement changed concurrently. Refresh and try again.");
    }

    await tx.settlementEvent.create({
      data: {
        settlementId: operation.settlement.id,
        fromStatus: operation.settlement.status,
        toStatus: SettlementStatus.FAILED,
        actorId: input.userId,
        note: "Uncertain provider execution closed with externally confirmed no side effect.",
      },
    });
    await writeAuditLog({
      action: "settlement.transition",
      resourceType: "settlement",
      resourceId: operation.settlement.id,
      organizationId: input.organizationId,
      userId: input.userId,
      before: { status: operation.settlement.status },
      after: {
        fromStatus: operation.settlement.status,
        toStatus: SettlementStatus.FAILED,
        providerOperationId: operation.id,
      },
    }, tx);
    await writeAuditLog({
      action: "provider.operation.resolved_no_effect",
      resourceType: "provider_operation",
      resourceId: operation.id,
      organizationId: input.organizationId,
      userId: input.userId,
      after: {
        providerCode: operation.providerCode,
        settlementId: operation.settlement.id,
        dualControl: true,
        resolutionNoteLength: note.length,
      },
    }, tx);
    return { resolved: true, status: ProviderOperationStatus.RESOLVED_NO_EFFECT };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
