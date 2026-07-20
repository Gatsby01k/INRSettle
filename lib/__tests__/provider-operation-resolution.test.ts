import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderOperationStatus, ProviderOperationType, SettlementStatus } from "@prisma/client";

const mock = vi.hoisted(() => {
  const settlement = {
    id: "set-1",
    organizationId: "org-1",
    createdById: "creator-1",
    status: "EXECUTING",
    providerStatus: null as string | null,
    providerTransactionId: null as string | null,
  };
  const operation = {
    id: "op-1",
    organizationId: "org-1",
    settlementId: settlement.id,
    providerCode: "pontis",
    providerReference: null as string | null,
    operationType: "EXECUTION",
    status: "REVIEW_REQUIRED",
    settlement,
  };
  const events: Record<string, unknown>[] = [];
  const audits: Record<string, unknown>[] = [];
  const prisma = {
    providerOperation: {
      findFirst: vi.fn(async () => ({ ...operation, settlement: { ...settlement } })),
      updateMany: vi.fn(async ({ where, data }) => {
        if (where.id !== operation.id || where.status !== operation.status) return { count: 0 };
        Object.assign(operation, data);
        return { count: 1 };
      }),
    },
    settlement: {
      updateMany: vi.fn(async ({ where, data }) => {
        if (where.id !== settlement.id || where.status !== settlement.status) return { count: 0 };
        Object.assign(settlement, data);
        return { count: 1 };
      }),
    },
    settlementEvent: {
      create: vi.fn(async ({ data }) => {
        events.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };
  const checkStatus = vi.fn(async () => ({}));
  const writeAuditLog = vi.fn(async (input) => {
    audits.push(input);
    return input;
  });
  return { settlement, operation, events, audits, prisma, checkStatus, writeAuditLog };
});

vi.mock("@/lib/prisma", () => ({ prisma: mock.prisma }));
vi.mock("@/lib/providers/service", () => ({ checkSettlementProviderStatus: mock.checkStatus }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mock.writeAuditLog }));

import {
  confirmProviderOperationNoEffect,
  NO_EFFECT_CONFIRMATION,
  syncReviewRequiredOperation,
} from "@/lib/providers/resolution";

describe("provider operation resolution", () => {
  beforeEach(() => {
    Object.assign(mock.settlement, {
      createdById: "creator-1",
      status: SettlementStatus.EXECUTING,
      providerStatus: null,
      providerTransactionId: null,
    });
    Object.assign(mock.operation, {
      providerReference: null,
      operationType: ProviderOperationType.EXECUTION,
      status: ProviderOperationStatus.REVIEW_REQUIRED,
    });
    mock.events.length = 0;
    mock.audits.length = 0;
    vi.clearAllMocks();
  });

  it("atomically closes a no-effect operation and fails the settlement", async () => {
    const result = await confirmProviderOperationNoEffect({
      operationId: mock.operation.id,
      organizationId: "org-1",
      userId: "approver-2",
      confirmation: NO_EFFECT_CONFIRMATION,
      note: "Confirmed in provider support ticket P-123.",
    });

    expect(result.status).toBe(ProviderOperationStatus.RESOLVED_NO_EFFECT);
    expect(mock.operation.status).toBe(ProviderOperationStatus.RESOLVED_NO_EFFECT);
    expect(mock.settlement.status).toBe(SettlementStatus.FAILED);
    expect(mock.events).toHaveLength(1);
    expect(mock.audits.map((entry) => entry.action)).toEqual([
      "settlement.transition",
      "provider.operation.resolved_no_effect",
    ]);
  });

  it("blocks creator self-resolution and any operation with a provider reference", async () => {
    await expect(confirmProviderOperationNoEffect({
      operationId: mock.operation.id,
      organizationId: "org-1",
      userId: "creator-1",
      confirmation: NO_EFFECT_CONFIRMATION,
      note: "Confirmed in provider support ticket P-123.",
    })).rejects.toThrow(/creator cannot resolve/i);

    mock.operation.providerReference = "provider-ref-1";
    await expect(confirmProviderOperationNoEffect({
      operationId: mock.operation.id,
      organizationId: "org-1",
      userId: "approver-2",
      confirmation: NO_EFFECT_CONFIRMATION,
      note: "Confirmed in provider support ticket P-123.",
    })).rejects.toThrow(/provider reference exists/i);
  });

  it("closes an uncertain operation only after status polling reaches a final state", async () => {
    mock.settlement.status = SettlementStatus.SETTLED;
    mock.settlement.providerStatus = "completed";
    mock.settlement.providerTransactionId = "tx-1";

    const result = await syncReviewRequiredOperation("op-1", "approver-2", "org-1");

    expect(mock.checkStatus).toHaveBeenCalledWith("set-1", "approver-2", "org-1");
    expect(result).toMatchObject({ resolved: true, status: ProviderOperationStatus.RESOLVED_BY_STATUS });
    expect(mock.operation.status).toBe(ProviderOperationStatus.RESOLVED_BY_STATUS);
  });
});
