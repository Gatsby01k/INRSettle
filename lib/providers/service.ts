import "server-only";

import crypto from "node:crypto";
import {
  Prisma,
  ProviderConnectionStatus,
  ProviderOperationStatus,
  ProviderOperationType,
  SettlementStatus,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import { fundingAllowsExecution } from "@/lib/funding";
import { prisma } from "@/lib/prisma";
import type { ProviderExecutionResult } from "@/lib/providers/contracts";
import { providerConnector, providerConnectorForPersistedName } from "@/lib/providers/registry";

/**
 * Executes a settlement through an explicitly selected connector and records a
 * durable operation before the external side effect. A failed/uncertain call is
 * left in REVIEW_REQUIRED and is never automatically re-submitted: an operator
 * must resolve provider status first, preventing accidental duplicate payouts.
 */
export async function executeSettlementWithProvider(
  providerCode: string,
  settlementId: string,
  userId: string,
  organizationId: string,
): Promise<ProviderExecutionResult> {
  const connector = providerConnector(providerCode);
  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, organizationId },
  });
  if (!settlement) throw new UserFacingError("Settlement was not found.");
  if (settlement.status !== SettlementStatus.APPROVED) {
    throw new UserFacingError("Only APPROVED settlements can be sent to a provider.");
  }
  // This check must happen before the connector is called. Relying on the
  // later APPROVED -> EXECUTING transition is unsafe because the provider may
  // already have accepted the payout by the time that transition rejects it.
  if (!fundingAllowsExecution(settlement.fundingStatus)) {
    throw new UserFacingError(
      `Settlement funding is ${settlement.fundingStatus}; provider execution requires FUNDED or NOT_REQUIRED.`,
    );
  }
  if (settlement.provider && settlement.provider.toLowerCase() !== connector.persistedName.toLowerCase()) {
    throw new UserFacingError(
      `Settlement is already assigned to ${settlement.provider}; provider reassignment requires an explicit review workflow.`,
    );
  }

  const idempotencyKey = `${settlement.publicId}:execution:v1`;
  const existing = await prisma.providerOperation.findUnique({
    where: {
      organizationId_providerCode_idempotencyKey: { organizationId, providerCode, idempotencyKey },
    },
  });

  if (existing?.status === ProviderOperationStatus.SUCCEEDED) {
    const fresh = await prisma.settlement.findFirstOrThrow({ where: { id: settlement.id, organizationId } });
    return {
      operationId: existing.id,
      providerCode,
      providerReference: fresh.providerTransactionId,
      providerStatus: fresh.providerStatus,
      settlementStatus: fresh.status,
      replayed: true,
    };
  }
  if (existing) {
    throw new UserFacingError(
      `Provider execution is ${existing.status.toLowerCase().replaceAll("_", " ")}. Resolve or review operation ${existing.id} before retrying.`,
    );
  }

  const connection = await prisma.providerConnection.findUnique({
    where: { organizationId_providerCode: { organizationId, providerCode } },
  });
  if (!connection) {
    throw new UserFacingError(
      `${connector.displayName} has no tenant connection. An administrator must register and review the connection before execution.`,
    );
  }
  if (
    connection.status !== ProviderConnectionStatus.SANDBOX_READY &&
    connection.status !== ProviderConnectionStatus.PILOT_READY
  ) {
    throw new UserFacingError(
      `${connector.displayName} connection is ${connection.status}; execution requires SANDBOX_READY or PILOT_READY.`,
    );
  }

  const operation = await prisma.$transaction(async (tx) => {
    const created = await tx.providerOperation.create({
      data: {
        organizationId,
        settlementId: settlement.id,
        providerConnectionId: connection.id,
        providerCode,
        operationType: ProviderOperationType.EXECUTION,
        status: ProviderOperationStatus.IN_FLIGHT,
        idempotencyKey,
        requestSummary: {
          publicId: settlement.publicId,
          corridor: settlement.corridor,
          sourceAmount: settlement.sourceAmount.toString(),
          sourceCurrency: settlement.sourceCurrency,
          targetAmount: settlement.targetAmount.toString(),
          targetCurrency: settlement.targetCurrency,
          testMode: settlement.testMode,
        },
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    });

    await tx.settlement.update({
      where: { id: settlement.id },
      data: {
        provider: connector.persistedName,
        providerConnectionId: connection.id,
      },
    });

    await writeAuditLog({
      action: "provider.operation.started",
      resourceType: "provider_operation",
      resourceId: created.id,
      organizationId,
      userId,
      after: { providerCode, operationType: created.operationType, idempotencyKey },
    }, tx);

    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  try {
    await connector.execute({
      settlementId,
      userId,
      organizationId,
      connection: {
        id: connection.id,
        credentialsRef: connection.credentialsRef,
        configuration: connection.configuration,
      },
    });
    const fresh = await prisma.settlement.findFirstOrThrow({ where: { id: settlement.id, organizationId } });

    await prisma.$transaction(async (tx) => {
      await tx.providerOperation.update({
        where: { id: operation.id },
        data: {
          status: ProviderOperationStatus.SUCCEEDED,
          providerReference: fresh.providerTransactionId,
          responseSummary: {
            settlementStatus: fresh.status,
            providerStatus: fresh.providerStatus,
            providerReference: fresh.providerTransactionId,
          },
          errorCode: null,
          errorMessage: null,
        },
      });
      await writeAuditLog({
        action: "provider.operation.completed",
        resourceType: "provider_operation",
        resourceId: operation.id,
        organizationId,
        userId,
        after: {
          providerCode,
          providerReference: fresh.providerTransactionId,
          providerStatus: fresh.providerStatus,
          settlementStatus: fresh.status,
        },
      }, tx);
    });

    return {
      operationId: operation.id,
      providerCode,
      providerReference: fresh.providerTransactionId,
      providerStatus: fresh.providerStatus,
      settlementStatus: fresh.status,
      replayed: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider execution failed.";
    await prisma.$transaction(async (tx) => {
      await tx.providerOperation.update({
        where: { id: operation.id },
        data: {
          status: ProviderOperationStatus.REVIEW_REQUIRED,
          errorCode: "PROVIDER_OUTCOME_UNCERTAIN",
          errorMessage: message,
          nextRetryAt: null,
        },
      });
      await writeAuditLog({
        action: "provider.operation.review_required",
        resourceType: "provider_operation",
        resourceId: operation.id,
        organizationId,
        userId,
        after: { providerCode, errorCode: "PROVIDER_OUTCOME_UNCERTAIN", message },
      }, tx);
    });
    throw error;
  }
}

/** Records every provider status poll as a separate, retry-safe operation. */
export async function checkSettlementProviderStatus(
  settlementId: string,
  userId: string,
  organizationId: string,
): Promise<ProviderExecutionResult> {
  const settlement = await prisma.settlement.findFirst({ where: { id: settlementId, organizationId } });
  if (!settlement) throw new UserFacingError("Settlement was not found.");
  if (!settlement.provider) throw new UserFacingError("Settlement has no assigned provider connector.");

  const connector = providerConnectorForPersistedName(settlement.provider);
  if (!connector.checkStatus) {
    throw new UserFacingError(`${connector.displayName} does not expose a status-poll adapter yet.`);
  }

  const providerCode = connector.code;
  const connection = await prisma.providerConnection.findUnique({
    where: { organizationId_providerCode: { organizationId, providerCode } },
  });
  const operation = await prisma.$transaction(async (tx) => {
    const created = await tx.providerOperation.create({
      data: {
        organizationId,
        settlementId: settlement.id,
        providerConnectionId: connection?.id ?? null,
        providerCode,
        operationType: ProviderOperationType.STATUS_CHECK,
        status: ProviderOperationStatus.IN_FLIGHT,
        idempotencyKey: `${settlement.publicId}:status:${crypto.randomUUID()}`,
        requestSummary: { providerReference: settlement.providerTransactionId },
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    });
    await writeAuditLog({
      action: "provider.status_check.started",
      resourceType: "provider_operation",
      resourceId: created.id,
      organizationId,
      userId,
      after: { providerCode, providerReference: settlement.providerTransactionId },
    }, tx);
    return created;
  });

  try {
    await connector.checkStatus({
      settlementId,
      userId,
      organizationId,
      connection: connection
        ? {
            id: connection.id,
            credentialsRef: connection.credentialsRef,
            configuration: connection.configuration,
          }
        : null,
    });
    const fresh = await prisma.settlement.findFirstOrThrow({ where: { id: settlement.id, organizationId } });
    await prisma.$transaction(async (tx) => {
      await tx.providerOperation.update({
        where: { id: operation.id },
        data: {
          status: ProviderOperationStatus.SUCCEEDED,
          providerReference: fresh.providerTransactionId,
          responseSummary: {
            settlementStatus: fresh.status,
            providerStatus: fresh.providerStatus,
          },
        },
      });
      await writeAuditLog({
        action: "provider.status_check.completed",
        resourceType: "provider_operation",
        resourceId: operation.id,
        organizationId,
        userId,
        after: {
          providerCode,
          providerReference: fresh.providerTransactionId,
          providerStatus: fresh.providerStatus,
          settlementStatus: fresh.status,
        },
      }, tx);
    });
    return {
      operationId: operation.id,
      providerCode,
      providerReference: fresh.providerTransactionId,
      providerStatus: fresh.providerStatus,
      settlementStatus: fresh.status,
      replayed: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider status check failed.";
    await prisma.$transaction(async (tx) => {
      await tx.providerOperation.update({
        where: { id: operation.id },
        data: {
          status: ProviderOperationStatus.FAILED,
          errorCode: "STATUS_CHECK_FAILED",
          errorMessage: message,
        },
      });
      await writeAuditLog({
        action: "provider.status_check.failed",
        resourceType: "provider_operation",
        resourceId: operation.id,
        organizationId,
        userId,
        after: { providerCode, errorCode: "STATUS_CHECK_FAILED", message },
      }, tx);
    });
    throw error;
  }
}

export function providerOperationJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
