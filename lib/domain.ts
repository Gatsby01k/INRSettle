import { Prisma, QuoteStatus, ReconciliationStatus, SettlementStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicSettlementId } from "@/lib/utils";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import {
  AUTO_MATCH_MIN_CONFIDENCE,
  INDEPENDENT_RECONCILIATION_SOURCES,
  PROVIDER_CLAIM_SOURCE,
  SUGGESTED_MIN_CONFIDENCE,
  computeConfidence,
  isIndependentReconciliationSource,
  matchReasonFor,
  type MatchOrigin,
} from "@/lib/reconciliation";
import { quoteSchema, reconciliationSchema, settlementSchema, settingsSchema } from "@/lib/validators";
import { assertValidSettlementTransition } from "@/lib/settlement-lifecycle";
import { resolveQuoteRates } from "@/lib/quote-rate";

export async function createQuote(input: unknown, userId: string, organizationId: string) {
  const data = quoteSchema.parse(input);
  const sourceCurrency = data.corridor === "INR_USDT" ? "INR" : "USDT";
  const targetCurrency = data.corridor === "INR_USDT" ? "USDT" : "INR";

  // Quote rate: env-configured manual desk rate (QUOTE_RATE_USDT_INR). There
  // is NO live FX feed; production without a configured rate fails closed —
  // see lib/quote-rate.ts.
  let rates: ReturnType<typeof resolveQuoteRates>;
  try {
    rates = resolveQuoteRates();
  } catch (error) {
    throw new UserFacingError(error instanceof Error ? error.message : "Quote rate is not configured.");
  }
  const rate = rates[data.corridor];
  const feeBps = 45;
  const feeAmount = data.sourceAmount * (feeBps / 10000);
  const targetAmount =
    data.corridor === "INR_USDT"
      ? (data.sourceAmount - feeAmount) / rate
      : (data.sourceAmount - feeAmount) * rate;

  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId } });
  const quote = await prisma.quote.create({
    data: {
      organizationId,
      createdById: userId,
      corridor: data.corridor,
      sourceCurrency,
      targetCurrency,
      sourceAmount: new Prisma.Decimal(data.sourceAmount),
      targetAmount: new Prisma.Decimal(targetAmount),
      rate: new Prisma.Decimal(rate),
      feeBps,
      feeAmount: new Prisma.Decimal(feeAmount),
      settlementWindow: data.settlementWindow,
      expiresAt: new Date(Date.now() + (settings?.quoteTtlSeconds ?? 900) * 1000),
    },
  });

  await writeAuditLog({
    action: "quote.create",
    resourceType: "quote",
    resourceId: quote.id,
    organizationId,
    userId,
    after: { ...quote, rateSource: rates.source, rateSourceLabel: rates.label },
  });

  return quote;
}

export async function createSettlement(input: unknown, userId: string, organizationId: string) {
  const data = settlementSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const quote = await tx.quote.findFirst({
      where: {
        id: data.quoteId,
        organizationId,
        status: QuoteStatus.ACTIVE,
        expiresAt: { gt: now },
      },
    });

    if (!quote) {
      throw new UserFacingError("Selected quote is unavailable, expired, or does not belong to this organization.");
    }

    // Claim the quote conditionally inside the same transaction. Combined with
    // Settlement.quoteId uniqueness this prevents two concurrent requests from
    // consuming one quote and creating two settlements.
    const claimed = await tx.quote.updateMany({
      where: {
        id: quote.id,
        organizationId,
        status: QuoteStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      data: { status: QuoteStatus.ACCEPTED },
    });
    if (claimed.count !== 1) {
      throw new UserFacingError("Selected quote was already consumed or expired.");
    }

    const created = await tx.settlement.create({
      data: {
        publicId: publicSettlementId(),
        organizationId,
        createdById: userId,
        quoteId: quote.id,
        reference: data.reference,
        corridor: quote.corridor,
        sourceCurrency: quote.sourceCurrency,
        targetCurrency: quote.targetCurrency,
        sourceAmount: quote.sourceAmount,
        targetAmount: quote.targetAmount,
        feeAmount: quote.feeAmount,
        sourceAccount: data.sourceAccount,
        targetAccount: data.targetAccount,
        status: SettlementStatus.REQUESTED,
        // New commercial records represent provider-executed operations.
        // INRSettle observes and controls the workflow; it does not execute or
        // fund the settlement itself.
        testMode: "PROVIDER_OBSERVED",
      },
    });

    await tx.settlementEvent.create({
      data: {
        settlementId: created.id,
        toStatus: SettlementStatus.REQUESTED,
        actorId: userId,
        note: "Settlement created from accepted quote.",
      },
    });

    await writeAuditLog({
      action: "settlement.create",
      resourceType: "settlement",
      resourceId: created.id,
      organizationId,
      userId,
      after: created,
    }, tx);

    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function transitionSettlement(
  settlementId: string,
  status: SettlementStatus,
  userId: string,
  organizationId: string,
  note?: string,
  options: { allowReconcile?: boolean } = {},
) {
  if (status === SettlementStatus.RECONCILED && !options.allowReconcile) {
    throw new UserFacingError("Settlements can only be reconciled by a matched reconciliation record.");
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.settlement.findFirst({
      where: { id: settlementId, organizationId },
    });

    if (!current) {
      throw new UserFacingError("Settlement was not found.");
    }

    assertValidSettlementTransition(current.status, status);

    if (
      status === SettlementStatus.EXECUTING &&
      current.fundingStatus !== "NOT_REQUIRED" &&
      current.fundingStatus !== "FUNDED"
    ) {
      throw new UserFacingError(
        `Settlement funding is ${current.fundingStatus}; execution requires FUNDED or NOT_REQUIRED.`,
      );
    }

    const claimed = await tx.settlement.updateMany({
      where: { id: settlementId, organizationId, status: current.status },
      data: {
        status,
        approvedAt: status === SettlementStatus.APPROVED ? new Date() : current.approvedAt,
        executedAt: status === SettlementStatus.EXECUTING ? new Date() : current.executedAt,
        settledAt: status === SettlementStatus.SETTLED ? new Date() : current.settledAt,
        reconciledAt: status === SettlementStatus.RECONCILED ? new Date() : current.reconciledAt,
      },
    });
    if (claimed.count !== 1) {
      throw new UserFacingError("Settlement status changed concurrently. Refresh and try again.");
    }

    const next = await tx.settlement.findUniqueOrThrow({ where: { id: settlementId } });

    await tx.settlementEvent.create({
      data: {
        settlementId,
        fromStatus: current.status,
        toStatus: status,
        actorId: userId,
        note,
      },
    });

    await writeAuditLog({
      action: "settlement.transition",
      resourceType: "settlement",
      resourceId: settlementId,
      organizationId,
      userId,
      before: {
        id: current.id,
        publicId: current.publicId,
        reference: current.reference,
        status: current.status,
      },
      after: {
        id: next.id,
        publicId: next.publicId,
        reference: next.reference,
        fromStatus: current.status,
        toStatus: next.status,
      },
    }, tx);

    return next;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

const AUTO_REF_PREFIX = "BANK-AUTO-";

/**
 * Generates the next sequential auto external reference for an organization
 * (BANK-AUTO-001, BANK-AUTO-002, ...). Used when an operator leaves the external
 * reference blank so reconciliation feels like a matching engine, not data entry.
 */
async function generateExternalRef(organizationId: string): Promise<string> {
  const existing = await prisma.reconciliationRecord.findMany({
    where: { organizationId, externalRef: { startsWith: AUTO_REF_PREFIX } },
    select: { externalRef: true },
  });

  let max = 0;
  for (const { externalRef } of existing) {
    const parsed = Number.parseInt(externalRef.slice(AUTO_REF_PREFIX.length), 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }

  return `${AUTO_REF_PREFIX}${String(max + 1).padStart(3, "0")}`;
}

export async function createReconciliationRecord(input: unknown, userId: string, organizationId: string) {
  const data = reconciliationSchema.parse(input);
  const externalRef =
    data.externalRef && data.externalRef.trim()
      ? data.externalRef.trim()
      : await generateExternalRef(organizationId);
  const matchedSettlement = data.settlementId
    ? await prisma.settlement.findFirst({
        where: {
          id: data.settlementId,
          organizationId,
        },
      })
    : null;

  if (data.settlementId && !matchedSettlement) {
    throw new UserFacingError("Selected settlement was not found for this organization.");
  }

  if (data.status === "MATCHED" && !matchedSettlement) {
    throw new UserFacingError("A MATCHED reconciliation record must be linked to a settlement.");
  }

  // Provider claims are never independent reconciliation evidence: a record
  // that only restates the payout provider's own claim cannot be MATCHED to a
  // settlement (and therefore can never reconcile one). It may exist as an
  // OPEN/EXCEPTION record for visibility only.
  if (data.source === PROVIDER_CLAIM_SOURCE && (data.status === "MATCHED" || matchedSettlement)) {
    throw new UserFacingError(
      "A provider_claim record cannot be matched to a settlement — reconciliation requires independent evidence (bank statement, PSP report, or operator confirmation).",
    );
  }

  if (data.status === "MATCHED" && data.exceptionReason) {
    throw new UserFacingError("A MATCHED reconciliation record cannot include an exception reason.");
  }

  if (data.status === "EXCEPTION" && matchedSettlement) {
    throw new UserFacingError("An EXCEPTION reconciliation record cannot be linked to a settlement.");
  }

  if (data.status === "UNMATCHED" && matchedSettlement) {
    throw new UserFacingError("An UNMATCHED reconciliation record cannot be linked to a settlement.");
  }

  if (data.status === "MATCHED" && matchedSettlement?.status !== SettlementStatus.SETTLED) {
    throw new UserFacingError("Only SETTLED settlements can be matched for reconciliation.");
  }

  if (data.status === "MATCHED" && matchedSettlement) {
    const confidence = computeConfidence(data.amount, data.currency, new Date(data.valueDate), {
      sourceCurrency: matchedSettlement.sourceCurrency,
      targetCurrency: matchedSettlement.targetCurrency,
      sourceAmount: Number(matchedSettlement.sourceAmount),
      targetAmount: Number(matchedSettlement.targetAmount),
      refDate: matchedSettlement.settledAt ?? matchedSettlement.createdAt,
    });
    if (confidence <= 0) {
      throw new UserFacingError(
        "The selected settlement does not match this record's amount and currency.",
      );
    }
  }

  // A manual match (operator picks a settlement at create time) is an explicit,
  // operator-driven reconciliation — tag its origin so the UI never labels it "Auto".
  const isManualMatch = data.status === "MATCHED" && Boolean(matchedSettlement);
  const payloadData = { ...data, externalRef };
  const rawPayload: Prisma.InputJsonValue = isManualMatch
    ? ({ ...payloadData, _matchOrigin: "MANUAL" } as Prisma.InputJsonValue)
    : (payloadData as Prisma.InputJsonValue);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.reconciliationRecord.findFirst({
      where: { organizationId, source: data.source, externalRef },
    });
    if (existing) {
      throw new UserFacingError("A reconciliation record with this external reference already exists for this source.");
    }

    const freshSettlement = matchedSettlement
      ? await tx.settlement.findFirst({
          where: { id: matchedSettlement.id, organizationId },
        })
      : null;
    if (matchedSettlement && !freshSettlement) {
      throw new UserFacingError("Selected settlement was not found for this organization.");
    }
    if (data.status === "MATCHED" && freshSettlement?.status !== SettlementStatus.SETTLED) {
      throw new UserFacingError("Only SETTLED settlements can be matched for reconciliation.");
    }
    if (data.status === "MATCHED" && freshSettlement) {
      const confidence = computeConfidence(data.amount, data.currency, new Date(data.valueDate), {
        sourceCurrency: freshSettlement.sourceCurrency,
        targetCurrency: freshSettlement.targetCurrency,
        sourceAmount: Number(freshSettlement.sourceAmount),
        targetAmount: Number(freshSettlement.targetAmount),
        refDate: freshSettlement.settledAt ?? freshSettlement.createdAt,
      });
      if (confidence <= 0) {
        throw new UserFacingError(
          "The selected settlement does not match this record's amount and currency.",
        );
      }
    }

    const record = await tx.reconciliationRecord.create({
      data: {
        organizationId,
        settlementId: freshSettlement?.id || null,
        externalRef,
        source: data.source,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency,
        valueDate: new Date(data.valueDate),
        status: data.status as ReconciliationStatus,
        exceptionReason: data.exceptionReason,
        rawPayload,
      },
    });

    if (record.settlementId && record.status === ReconciliationStatus.MATCHED && freshSettlement) {
      const claimed = await tx.settlement.updateMany({
        where: {
          id: freshSettlement.id,
          organizationId,
          status: SettlementStatus.SETTLED,
        },
        data: { status: SettlementStatus.RECONCILED, reconciledAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new UserFacingError("Settlement reconciliation state changed concurrently. Refresh and try again.");
      }
      await tx.settlementEvent.create({
        data: {
          settlementId: freshSettlement.id,
          fromStatus: SettlementStatus.SETTLED,
          toStatus: SettlementStatus.RECONCILED,
          actorId: userId,
          note: "Matched by reconciliation.",
        },
      });
      await writeAuditLog({
        action: "settlement.transition",
        resourceType: "settlement",
        resourceId: freshSettlement.id,
        organizationId,
        userId,
        before: { status: SettlementStatus.SETTLED },
        after: {
          fromStatus: SettlementStatus.SETTLED,
          toStatus: SettlementStatus.RECONCILED,
          reconciliationRecordId: record.id,
        },
      }, tx);
    }

    await writeAuditLog({
      action: "reconciliation.create",
      resourceType: "reconciliation_record",
      resourceId: record.id,
      organizationId,
      userId,
      after: {
        id: record.id,
        status: record.status,
        externalRef: record.externalRef,
        source: record.source,
        amount: record.amount.toString(),
        currency: record.currency,
        settlementId: record.settlementId,
        settlementPublicId: freshSettlement?.publicId,
        settlementReference: freshSettlement?.reference,
      },
    }, tx);

    return record;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

type SettlementCandidate = {
  id: string;
  publicId: string;
  reference: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: Prisma.Decimal;
  targetAmount: Prisma.Decimal;
  settledAt: Date | null;
  createdAt: Date;
};

type RecordForMatch = {
  amount: Prisma.Decimal;
  currency: string;
  valueDate: Date;
};

/** Settlement IDs an operator has explicitly rejected for a record (stored in rawPayload). */
export function rejectedSettlementIdsOf(rawPayload: Prisma.JsonValue | null | undefined): string[] {
  if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
    const value = (rawPayload as Record<string, unknown>)._rejectedSettlementIds;
    if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string");
  }
  return [];
}

/** How a linked record was matched (stored in rawPayload): "AUTO" by the engine, "MANUAL" by an operator. */
export function matchOriginOf(rawPayload: Prisma.JsonValue | null | undefined): MatchOrigin | null {
  if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
    const value = (rawPayload as Record<string, unknown>)._matchOrigin;
    if (value === "AUTO" || value === "MANUAL") return value;
  }
  return null;
}

function baseRawPayload(rawPayload: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
    ? (rawPayload as Record<string, unknown>)
    : {};
}

/**
 * Finds the highest-confidence settlement candidate for a record using
 * amount + currency + value date. Returns null when nothing meets `minConfidence`.
 */
export function bestSettlementMatch<T extends SettlementCandidate>(
  record: RecordForMatch,
  candidates: T[],
  options: { excludeSettlementIds?: Set<string>; usedSettlementIds?: Set<string>; minConfidence?: number } = {},
): { settlement: T; confidence: number } | null {
  const min = options.minConfidence ?? SUGGESTED_MIN_CONFIDENCE;
  let best: { settlement: T; confidence: number } | null = null;
  let ambiguous = false;

  for (const settlement of candidates) {
    if (options.excludeSettlementIds?.has(settlement.id)) continue;
    if (options.usedSettlementIds?.has(settlement.id)) continue;
    const confidence = computeConfidence(Number(record.amount), record.currency, record.valueDate, {
      sourceCurrency: settlement.sourceCurrency,
      targetCurrency: settlement.targetCurrency,
      sourceAmount: Number(settlement.sourceAmount),
      targetAmount: Number(settlement.targetAmount),
      refDate: settlement.settledAt ?? settlement.createdAt,
    });
    if (confidence < min) continue;
    if (!best || confidence > best.confidence) {
      best = { settlement, confidence };
      ambiguous = false;
    } else if (confidence === best.confidence) {
      ambiguous = true;
    }
  }

  return ambiguous ? null : best;
}

type ReconciliationMatchOrigin = Extract<MatchOrigin, "AUTO" | "MANUAL">;

/**
 * Claims both sides of a reconciliation match in one serializable transaction.
 * The conditional updates are deliberate: without them, two workers/operators
 * can link different evidence records to the same SETTLED settlement, or leave a
 * MATCHED record behind when the settlement transition loses a race.
 */
async function commitReconciliationMatch(input: {
  recordId: string;
  settlementId: string;
  userId: string;
  organizationId: string;
  origin: ReconciliationMatchOrigin;
}) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.reconciliationRecord.findFirst({
      where: { id: input.recordId, organizationId: input.organizationId },
    });
    if (!record) {
      throw new UserFacingError("Reconciliation record was not found.");
    }
    if (record.settlementId) {
      throw new UserFacingError("This record is already linked to a settlement.");
    }
    if (
      record.status !== ReconciliationStatus.OPEN &&
      record.status !== ReconciliationStatus.UNMATCHED
    ) {
      if (record.status === ReconciliationStatus.EXCEPTION) {
        throw new UserFacingError("Exception records cannot be matched until the exception is resolved.");
      }
      throw new UserFacingError("Only OPEN or UNMATCHED reconciliation records can be matched.");
    }
    if (!isIndependentReconciliationSource(record.source)) {
      throw new UserFacingError(
        "A provider_claim record cannot be confirmed as a match — reconciliation requires independent evidence (bank statement, PSP report, or operator confirmation).",
      );
    }

    const settlement = await tx.settlement.findFirst({
      where: { id: input.settlementId, organizationId: input.organizationId },
    });
    if (!settlement) {
      throw new UserFacingError("Suggested settlement was not found for this organization.");
    }
    if (settlement.status !== SettlementStatus.SETTLED) {
      throw new UserFacingError("Only SETTLED settlements can be matched for reconciliation.");
    }

    const confidence = computeConfidence(Number(record.amount), record.currency, record.valueDate, {
      sourceCurrency: settlement.sourceCurrency,
      targetCurrency: settlement.targetCurrency,
      sourceAmount: Number(settlement.sourceAmount),
      targetAmount: Number(settlement.targetAmount),
      refDate: settlement.settledAt ?? settlement.createdAt,
    });
    if (confidence <= 0) {
      throw new UserFacingError("This settlement no longer matches the record's amount and currency.");
    }
    if (input.origin === "AUTO" && confidence < AUTO_MATCH_MIN_CONFIDENCE) {
      throw new UserFacingError("The record is no longer eligible for an exact automatic match.");
    }

    const recordClaim = await tx.reconciliationRecord.updateMany({
      where: {
        id: record.id,
        organizationId: input.organizationId,
        settlementId: null,
        status: { in: [ReconciliationStatus.OPEN, ReconciliationStatus.UNMATCHED] },
      },
      data: {
        status: ReconciliationStatus.MATCHED,
        settlementId: settlement.id,
        rawPayload: {
          ...baseRawPayload(record.rawPayload),
          _matchOrigin: input.origin,
        } as Prisma.InputJsonValue,
      },
    });
    if (recordClaim.count !== 1) {
      throw new UserFacingError("Reconciliation record changed concurrently. Refresh and try again.");
    }

    const settlementClaim = await tx.settlement.updateMany({
      where: {
        id: settlement.id,
        organizationId: input.organizationId,
        status: SettlementStatus.SETTLED,
      },
      data: { status: SettlementStatus.RECONCILED, reconciledAt: new Date() },
    });
    if (settlementClaim.count !== 1) {
      throw new UserFacingError("Settlement reconciliation state changed concurrently. Refresh and try again.");
    }

    const note = input.origin === "AUTO"
      ? `Auto-matched (100%) to ${record.externalRef}`
      : `Operator-confirmed match (${confidence}%) to ${record.externalRef}`;
    await tx.settlementEvent.create({
      data: {
        settlementId: settlement.id,
        fromStatus: SettlementStatus.SETTLED,
        toStatus: SettlementStatus.RECONCILED,
        actorId: input.userId,
        note,
      },
    });

    await writeAuditLog({
      action: "settlement.transition",
      resourceType: "settlement",
      resourceId: settlement.id,
      organizationId: input.organizationId,
      userId: input.userId,
      before: { status: SettlementStatus.SETTLED },
      after: {
        fromStatus: SettlementStatus.SETTLED,
        toStatus: SettlementStatus.RECONCILED,
        reconciliationRecordId: record.id,
      },
    }, tx);

    await writeAuditLog({
      action: input.origin === "AUTO"
        ? "reconciliation.auto_match"
        : "reconciliation.confirm_match",
      resourceType: "reconciliation_record",
      resourceId: record.id,
      organizationId: input.organizationId,
      userId: input.userId,
      after: {
        confidence,
        matchReason: matchReasonFor(confidence, record.currency),
        matchOrigin: input.origin,
        externalRef: record.externalRef,
        settlementId: settlement.id,
        settlementPublicId: settlement.publicId,
        settlementReference: settlement.reference,
      },
    }, tx);

    return { recordId: record.id, settlementId: settlement.id, confidence };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Auto-reconciliation engine. Scans the open/unmatched queue and only auto-links
 * records that match a SETTLED settlement at 100% confidence (amount + currency +
 * value date). Exact matches are linked, marked MATCHED, the settlement transitions
 * SETTLED -> RECONCILED, and a reconciliation.auto_match audit event is written —
 * with no operator action required. Lower-confidence candidates are intentionally
 * left for operator review (Confirm / Reject) and are not touched here.
 */
export async function autoMatchReconciliation(userId: string, organizationId: string) {
  const open = await prisma.reconciliationRecord.findMany({
    where: {
      organizationId,
      settlementId: null,
      status: { in: [ReconciliationStatus.OPEN, ReconciliationStatus.UNMATCHED] },
      source: { in: Array.from(INDEPENDENT_RECONCILIATION_SOURCES) },
    },
    orderBy: { createdAt: "asc" },
  });

  if (open.length === 0) return { matched: 0, scanned: 0 };

  const candidates = await prisma.settlement.findMany({
    where: { organizationId, status: SettlementStatus.SETTLED },
  });

  const used = new Set<string>();
  let matched = 0;

  for (const record of open) {
    // Provider claims never reconcile settlements: the engine only matches
    // independent evidence (bank statements, PSP reports, operator records).
    if (!isIndependentReconciliationSource(record.source)) continue;

    const rejected = new Set(rejectedSettlementIdsOf(record.rawPayload));

    // Exact (100%) candidates: same amount + same currency + same value date, SETTLED,
    // and neither previously rejected nor already consumed in this run.
    const exactMatches = candidates.filter((settlement) => {
      if (rejected.has(settlement.id) || used.has(settlement.id)) return false;
      const confidence = computeConfidence(Number(record.amount), record.currency, record.valueDate, {
        sourceCurrency: settlement.sourceCurrency,
        targetCurrency: settlement.targetCurrency,
        sourceAmount: Number(settlement.sourceAmount),
        targetAmount: Number(settlement.targetAmount),
        refDate: settlement.settledAt ?? settlement.createdAt,
      });
      return confidence >= AUTO_MATCH_MIN_CONFIDENCE;
    });

    // Only auto-reconcile when exactly one unambiguous 100% match exists. Zero (no
    // match) or more than one (ambiguous) are left for operator review.
    if (exactMatches.length !== 1) continue;

    const settlement = exactMatches[0];
    await commitReconciliationMatch({
      recordId: record.id,
      settlementId: settlement.id,
      userId,
      organizationId,
      origin: "AUTO",
    });
    used.add(settlement.id);
    matched += 1;
  }

  return { matched, scanned: open.length };
}

/**
 * Operator confirms a suggested (sub-100%) match. Links the record to the
 * settlement, marks it MATCHED, transitions the settlement to RECONCILED, and
 * writes an audit trail capturing the confidence and reason at confirmation time.
 */
export async function confirmReconciliationMatch(
  recordId: string,
  settlementId: string,
  userId: string,
  organizationId: string,
) {
  return commitReconciliationMatch({
    recordId,
    settlementId,
    userId,
    organizationId,
    origin: "MANUAL",
  });
}

/**
 * Operator rejects a suggested match. The record stays in manual review and the
 * rejected settlement is remembered (in rawPayload) so auto-match and the
 * suggestion panel never propose it again.
 */
export async function rejectReconciliationSuggestion(
  recordId: string,
  settlementId: string,
  userId: string,
  organizationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.reconciliationRecord.findFirst({
      where: { id: recordId, organizationId },
    });
    if (!record) {
      throw new UserFacingError("Reconciliation record was not found.");
    }
    if (record.settlementId) {
      throw new UserFacingError("This record is already linked and cannot reject a suggestion.");
    }
    if (
      record.status !== ReconciliationStatus.OPEN &&
      record.status !== ReconciliationStatus.UNMATCHED
    ) {
      throw new UserFacingError("Only OPEN or UNMATCHED records can reject a suggestion.");
    }
    if (!isIndependentReconciliationSource(record.source)) {
      throw new UserFacingError("Only independent reconciliation evidence can reject a match suggestion.");
    }

    const settlement = await tx.settlement.findFirst({
      where: { id: settlementId, organizationId, status: SettlementStatus.SETTLED },
    });
    if (!settlement) {
      throw new UserFacingError("Suggested settlement was not found or is no longer eligible.");
    }

    const confidence = computeConfidence(Number(record.amount), record.currency, record.valueDate, {
      sourceCurrency: settlement.sourceCurrency,
      targetCurrency: settlement.targetCurrency,
      sourceAmount: Number(settlement.sourceAmount),
      targetAmount: Number(settlement.targetAmount),
      refDate: settlement.settledAt ?? settlement.createdAt,
    });
    if (confidence < SUGGESTED_MIN_CONFIDENCE) {
      throw new UserFacingError("This settlement is not an eligible match suggestion for the record.");
    }

    const rejected = new Set(rejectedSettlementIdsOf(record.rawPayload));
    if (rejected.has(settlementId)) {
      throw new UserFacingError("This match suggestion was already rejected.");
    }
    rejected.add(settlementId);

    const claimed = await tx.reconciliationRecord.updateMany({
      where: {
        id: record.id,
        organizationId,
        settlementId: null,
        status: { in: [ReconciliationStatus.OPEN, ReconciliationStatus.UNMATCHED] },
      },
      data: {
        status: ReconciliationStatus.UNMATCHED,
        rawPayload: {
          ...baseRawPayload(record.rawPayload),
          _rejectedSettlementIds: Array.from(rejected),
        } as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1) {
      throw new UserFacingError("Reconciliation record changed concurrently. Refresh and try again.");
    }

    await writeAuditLog({
      action: "reconciliation.reject_match",
      resourceType: "reconciliation_record",
      resourceId: record.id,
      organizationId,
      userId,
      after: {
        externalRef: record.externalRef,
        rejectedSettlementId: settlementId,
        rejectedSettlementIds: Array.from(rejected),
      },
    }, tx);

    return { recordId: record.id, rejectedSettlementId: settlementId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Operator resolves an EXCEPTION record after reviewing it. The record moves from
 * EXCEPTION to RESOLVED so it drops off the exceptions queue / dashboard alert. It
 * never links a settlement and never reconciles one — resolving simply marks the
 * exception as reviewed.
 */
export async function resolveReconciliationException(
  recordId: string,
  userId: string,
  organizationId: string,
  note?: string,
) {
  const resolutionNote = note?.trim() || "Marked reviewed by operator.";
  return prisma.$transaction(async (tx) => {
    const record = await tx.reconciliationRecord.findFirst({
      where: { id: recordId, organizationId },
    });
    if (!record) {
      throw new UserFacingError("Reconciliation record was not found.");
    }
    if (record.status !== ReconciliationStatus.EXCEPTION) {
      throw new UserFacingError("Only EXCEPTION records can be resolved.");
    }

    const claimed = await tx.reconciliationRecord.updateMany({
      where: {
        id: record.id,
        organizationId,
        status: ReconciliationStatus.EXCEPTION,
        settlementId: null,
      },
      data: {
        status: ReconciliationStatus.RESOLVED,
        rawPayload: {
          ...baseRawPayload(record.rawPayload),
          _resolutionNote: resolutionNote,
        } as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1) {
      throw new UserFacingError("Exception state changed concurrently. Refresh and try again.");
    }

    const updated = await tx.reconciliationRecord.findFirst({
      where: { id: record.id, organizationId },
    });
    if (!updated) {
      throw new UserFacingError("Resolved reconciliation record could not be reloaded.");
    }

    await writeAuditLog({
      action: "reconciliation.resolve_exception",
      resourceType: "reconciliation_record",
      resourceId: record.id,
      organizationId,
      userId,
      before: { id: record.id, status: record.status, exceptionReason: record.exceptionReason },
      after: { id: updated.id, status: updated.status, resolutionNote },
    }, tx);

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateSettings(input: unknown, userId: string, organizationId: string) {
  const data = settingsSchema.parse(input);
  const before = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { settings: true },
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: { displayName: data.displayName },
    });

    return tx.organizationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        approvalThreshold: new Prisma.Decimal(data.approvalThreshold),
        quoteTtlSeconds: data.quoteTtlSeconds,
        reconciliationEmail: data.reconciliationEmail || null,
        webhookUrl: data.webhookUrl || null,
      },
      update: {
        approvalThreshold: new Prisma.Decimal(data.approvalThreshold),
        quoteTtlSeconds: data.quoteTtlSeconds,
        reconciliationEmail: data.reconciliationEmail || null,
        webhookUrl: data.webhookUrl || null,
      },
    });
  });

  await writeAuditLog({
    action: "settings.update",
    resourceType: "organization_settings",
    resourceId: updated.id,
    organizationId,
    userId,
    before,
    after: updated,
  });

  return updated;
}
