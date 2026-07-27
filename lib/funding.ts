import "server-only";

import {
  FundingStatus,
  Prisma,
  ProviderConnectionStatus,
  ProviderOperationStatus,
  ProviderOperationType,
  SettlementStatus,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const FUNDING_TRANSITIONS: Record<FundingStatus, FundingStatus[]> = {
  [FundingStatus.NOT_REQUIRED]: [FundingStatus.REQUESTED],
  [FundingStatus.REQUESTED]: [
    FundingStatus.ACKNOWLEDGED,
    FundingStatus.PARTIALLY_FUNDED,
    FundingStatus.FUNDED,
    FundingStatus.FAILED,
    FundingStatus.CANCELLED,
  ],
  [FundingStatus.ACKNOWLEDGED]: [
    FundingStatus.PARTIALLY_FUNDED,
    FundingStatus.FUNDED,
    FundingStatus.FAILED,
    FundingStatus.CANCELLED,
  ],
  [FundingStatus.PARTIALLY_FUNDED]: [FundingStatus.FUNDED, FundingStatus.FAILED, FundingStatus.CANCELLED],
  [FundingStatus.FUNDED]: [],
  [FundingStatus.FAILED]: [],
  [FundingStatus.CANCELLED]: [],
};

export function assertFundingTransition(from: FundingStatus, to: FundingStatus) {
  if (!FUNDING_TRANSITIONS[from].includes(to)) {
    throw new UserFacingError(`Cannot move funding from ${from} to ${to}.`);
  }
}

export function fundingAllowsExecution(status: FundingStatus): boolean {
  return status === FundingStatus.NOT_REQUIRED || status === FundingStatus.FUNDED;
}

type UpdateFundingInput = {
  settlementId: string;
  organizationId: string;
  userId: string;
  status: FundingStatus;
  requiredAmount?: number | null;
  fundedAmount?: number | null;
  currency?: string | null;
  providerCode?: string | null;
  providerReference?: string | null;
};

export async function updateSettlementFunding(input: UpdateFundingInput) {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findFirst({
      where: { id: input.settlementId, organizationId: input.organizationId },
    });
    if (!settlement) throw new UserFacingError("Settlement was not found.");
    if (settlement.status !== SettlementStatus.APPROVED) {
      throw new UserFacingError("Funding may only be changed while the settlement is APPROVED.");
    }

    assertFundingTransition(settlement.fundingStatus, input.status);

    const required = input.requiredAmount ?? (settlement.fundingRequired ? Number(settlement.fundingRequired) : null);
    const funded = input.fundedAmount ?? (settlement.fundedAmount ? Number(settlement.fundedAmount) : null);
    const currency = input.currency?.trim() || settlement.fundingCurrency;

    if (input.status !== FundingStatus.NOT_REQUIRED && (!required || required <= 0 || !currency)) {
      throw new UserFacingError("Positive required funding amount and currency are required.");
    }
    if (funded != null && funded < 0) throw new UserFacingError("Funded amount cannot be negative.");
    if (input.status === FundingStatus.PARTIALLY_FUNDED && (funded == null || funded <= 0 || funded >= required!)) {
      throw new UserFacingError("PARTIALLY_FUNDED requires an amount greater than zero and below the requirement.");
    }
    if (input.status === FundingStatus.FUNDED && (funded == null || funded < required!)) {
      throw new UserFacingError("FUNDED requires funded amount to meet or exceed the requirement.");
    }

    const updatedCount = await tx.settlement.updateMany({
      where: {
        id: settlement.id,
        organizationId: input.organizationId,
        fundingStatus: settlement.fundingStatus,
      },
      data: {
        fundingStatus: input.status,
        fundingRequired: required == null ? null : new Prisma.Decimal(required),
        fundedAmount: funded == null ? null : new Prisma.Decimal(funded),
        fundingCurrency: currency,
      },
    });
    if (updatedCount.count !== 1) {
      throw new UserFacingError("Funding state changed concurrently. Refresh and try again.");
    }

    const providerCode = input.providerCode?.trim() || "manual";
    const connection = providerCode === "manual"
      ? null
      : await tx.providerConnection.findUnique({
          where: {
            organizationId_providerCode: {
              organizationId: input.organizationId,
              providerCode,
            },
          },
        });

    if (
      providerCode !== "manual" &&
      (!connection ||
        (connection.status !== ProviderConnectionStatus.INTEGRATION_VERIFIED &&
          connection.status !== ProviderConnectionStatus.COMMERCIAL_READY))
    ) {
      throw new UserFacingError(
        `Funding provider ${providerCode} requires an integration-verified or commercially enabled tenant connection.`,
      );
    }

    if (input.status === FundingStatus.REQUESTED) {
      await tx.providerOperation.create({
        data: {
          organizationId: input.organizationId,
          settlementId: settlement.id,
          providerConnectionId: connection?.id ?? null,
          providerCode,
          operationType: ProviderOperationType.FUNDING_REQUEST,
          status: ProviderOperationStatus.PENDING,
          idempotencyKey: `${settlement.publicId}:funding:v1`,
          providerReference: input.providerReference?.trim() || null,
          requestSummary: { requiredAmount: required, currency },
        },
      });
    } else {
      const fundingOperation = await tx.providerOperation.findFirst({
        where: {
          organizationId: input.organizationId,
          settlementId: settlement.id,
          operationType: ProviderOperationType.FUNDING_REQUEST,
        },
        orderBy: { createdAt: "desc" },
      });
      if (fundingOperation) {
        const operationStatus =
          input.status === FundingStatus.FUNDED
            ? ProviderOperationStatus.SUCCEEDED
            : input.status === FundingStatus.FAILED || input.status === FundingStatus.CANCELLED
              ? ProviderOperationStatus.FAILED
              : ProviderOperationStatus.IN_FLIGHT;
        await tx.providerOperation.update({
          where: { id: fundingOperation.id },
          data: {
            status: operationStatus,
            providerReference: input.providerReference?.trim() || fundingOperation.providerReference,
            responseSummary: {
              fundingStatus: input.status,
              requiredAmount: required,
              fundedAmount: funded,
              currency,
            },
          },
        });
      }
    }

    await writeAuditLog({
      action: "settlement.funding.transition",
      resourceType: "settlement",
      resourceId: settlement.id,
      organizationId: input.organizationId,
      userId: input.userId,
      before: {
        fundingStatus: settlement.fundingStatus,
        requiredAmount: settlement.fundingRequired?.toString() ?? null,
        fundedAmount: settlement.fundedAmount?.toString() ?? null,
        currency: settlement.fundingCurrency,
      },
      after: {
        fundingStatus: input.status,
        requiredAmount: required,
        fundedAmount: funded,
        currency,
        providerCode: input.providerCode ?? null,
        providerReference: input.providerReference ?? null,
      },
    }, tx);

    return tx.settlement.findUniqueOrThrow({ where: { id: settlement.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
