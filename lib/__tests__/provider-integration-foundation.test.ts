import { describe, expect, it, vi } from "vitest";
import { FundingStatus } from "@prisma/client";
import { assertFundingTransition, fundingAllowsExecution } from "../funding";
import { providerProofDedupeKey } from "../provider-proof";
import { webhookPayloadHash } from "../providers/webhook-inbox";
import {
  NO_EFFECT_CONFIRMATION,
  validateNoEffectConfirmation,
} from "../providers/resolution";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/providers/service", () => ({ checkSettlementProviderStatus: vi.fn() }));

describe("provider integration safety foundation", () => {
  it("allows execution only when funding is not required or fully funded", () => {
    for (const status of Object.values(FundingStatus)) {
      expect(fundingAllowsExecution(status)).toBe(
        status === FundingStatus.NOT_REQUIRED || status === FundingStatus.FUNDED,
      );
    }
  });

  it("enforces the funding state machine", () => {
    expect(() => assertFundingTransition(FundingStatus.NOT_REQUIRED, FundingStatus.REQUESTED)).not.toThrow();
    expect(() => assertFundingTransition(FundingStatus.REQUESTED, FundingStatus.FUNDED)).not.toThrow();
    expect(() => assertFundingTransition(FundingStatus.FUNDED, FundingStatus.REQUESTED)).toThrow(/Cannot move funding/);
  });

  it("creates stable, status-sensitive provider proof keys", () => {
    const base = {
      settlementId: "set_1",
      provider: "Provider A",
      providerTransactionId: "txn_1",
      providerStatus: "completed",
      receivedVia: "WEBHOOK" as const,
    };
    expect(providerProofDedupeKey(base)).toBe(providerProofDedupeKey({ ...base }));
    expect(providerProofDedupeKey(base)).not.toBe(
      providerProofDedupeKey({ ...base, providerStatus: "failed" }),
    );
  });

  it("uses a deterministic payload hash when a provider sends no event id", () => {
    expect(webhookPayloadHash('{"id":1}')).toBe(webhookPayloadHash('{"id":1}'));
    expect(webhookPayloadHash('{"id":1}')).not.toBe(webhookPayloadHash('{"id":2}'));
  });

  it("requires an exact no-side-effect attestation and a substantive note", () => {
    expect(validateNoEffectConfirmation(NO_EFFECT_CONFIRMATION, "Confirmed by provider ticket 123.")).toMatch(/provider ticket/);
    expect(() => validateNoEffectConfirmation("CONFIRMED", "Confirmed by provider ticket 123.")).toThrow(/exactly/);
    expect(() => validateNoEffectConfirmation(NO_EFFECT_CONFIRMATION, "too short")).toThrow(/at least 12/);
  });
});
