import { describe, expect, it } from "vitest";
import { maskFinancialIdentifier } from "@/lib/utils";

describe("financial identifier masking", () => {
  it("keeps only the last four digits of account-like identifiers", () => {
    expect(maskFinancialIdentifier("1234 5678 9012")).toBe("Restricted · ending 9012");
    expect(maskFinancialIdentifier("HDFC-0001-23456789")).toBe("Restricted · ending 6789");
  });

  it("masks emails and long wallet-like identifiers", () => {
    expect(maskFinancialIdentifier("finance@example.com")).toBe("f•••@example.com");
    expect(maskFinancialIdentifier("TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE")).toBe("TQn9••••bLSE");
  });

  it("does not leak descriptive account labels", () => {
    expect(maskFinancialIdentifier("INR Operating Account")).toBe("Restricted account");
  });
});
