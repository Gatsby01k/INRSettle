import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSettlementData, encryptSettlementData } from "../sensitive-data";
import { redactProviderPayload } from "../providers/redaction";

const previousKey = process.env.SETTLEMENT_DATA_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.SETTLEMENT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString("base64url");
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.SETTLEMENT_DATA_ENCRYPTION_KEY;
  else process.env.SETTLEMENT_DATA_ENCRYPTION_KEY = previousKey;
});

describe("settlement instruction encryption", () => {
  it("round-trips structured beneficiary data without exposing plaintext", () => {
    const instruction = {
      beneficiaryName: "Meridian Components Private Limited",
      accountNumber: "50100040199211",
      bankCode: "HDFC0001234",
    };
    const ciphertext = encryptSettlementData(instruction);
    expect(ciphertext).toMatch(/^v1\./);
    expect(ciphertext).not.toContain(instruction.beneficiaryName);
    expect(ciphertext).not.toContain(instruction.accountNumber);
    expect(decryptSettlementData(ciphertext)).toEqual(instruction);
  });

  it("rejects a modified authentication tag", () => {
    const ciphertext = encryptSettlementData({ accountNumber: "50100040199211" });
    const parts = ciphertext.split(".");
    parts[2] = `${parts[2].startsWith("A") ? "B" : "A"}${parts[2].slice(1)}`;
    expect(() => decryptSettlementData(parts.join("."))).toThrow(/integrity verification/);
  });
});

describe("provider payload persistence boundary", () => {
  it("retains status evidence while redacting beneficiary and credential fields", () => {
    expect(
      redactProviderPayload({
        status: "completed",
        transaction_id: "pt_71084921",
        recipient_details: {
          name: "Meridian Components Private Limited",
          account_number: "50100040199211",
        },
        api_token: "provider-secret",
      }),
    ).toEqual({
      status: "completed",
      transaction_id: "pt_71084921",
      recipient_details: "[REDACTED]",
      api_token: "[REDACTED]",
    });
  });
});
