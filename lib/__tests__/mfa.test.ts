import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { encodeBase32, generateTotp, verifyTotp } from "@/lib/mfa";

describe("TOTP MFA", () => {
  const previousKey = process.env.MFA_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64url");
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previousKey;
  });

  it("matches the RFC 6238 SHA-1 vector truncated to six digits", () => {
    const secret = encodeBase32(Buffer.from("12345678901234567890", "ascii"));
    expect(generateTotp(secret, 59_000)).toBe("287082");
  });

  it("accepts the current code and adjacent clock windows", () => {
    const secret = encodeBase32(Buffer.alloc(20, 7));
    const now = 1_800_000;
    expect(verifyTotp(secret, generateTotp(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, generateTotp(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, generateTotp(secret, now + 30_000), now)).toBe(true);
  });

  it("rejects malformed, wrong, and out-of-window codes", () => {
    const secret = encodeBase32(Buffer.alloc(20, 3));
    const now = 1_800_000;
    expect(verifyTotp(secret, "12345", now)).toBe(false);
    expect(verifyTotp(secret, "abcdef", now)).toBe(false);
    expect(verifyTotp(secret, generateTotp(secret, now - 60_000), now)).toBe(false);
  });
});
