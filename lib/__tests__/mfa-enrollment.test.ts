import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const user = {
    id: "user-1",
    email: "operator@example.test",
    mfaEnabled: false,
    mfaSecretCiphertext: null as string | null,
    mfaPendingSecretCiphertext: null as string | null,
    mfaRecoveryCodeHashes: [] as string[],
    mfaEnrolledAt: null as Date | null,
    authVersion: 0,
  };

  function apply(data: Record<string, unknown>) {
    for (const [key, value] of Object.entries(data)) {
      if (key === "authVersion" && value && typeof value === "object" && "increment" in value) {
        user.authVersion += Number((value as { increment: number }).increment);
      } else if (key === "mfaRecoveryCodeHashes" && value && typeof value === "object" && "set" in value) {
        user.mfaRecoveryCodeHashes = [...(value as { set: string[] }).set];
      } else {
        Object.assign(user, { [key]: value });
      }
    }
  }

  const prisma = {
    user: {
      findUnique: vi.fn(async () => ({ ...user, mfaRecoveryCodeHashes: [...user.mfaRecoveryCodeHashes] })),
      update: vi.fn(async ({ data, select }) => {
        apply(data);
        return select?.authVersion ? { authVersion: user.authVersion } : { ...user };
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        if (where.id !== user.id) return { count: 0 };
        if (where.mfaEnabled !== undefined && where.mfaEnabled !== user.mfaEnabled) return { count: 0 };
        if (
          where.mfaPendingSecretCiphertext !== undefined &&
          where.mfaPendingSecretCiphertext !== user.mfaPendingSecretCiphertext
        ) return { count: 0 };
        if (
          where.authVersion !== undefined &&
          where.authVersion !== user.authVersion
        ) return { count: 0 };
        if (
          where.mfaRecoveryCodeHashes?.has &&
          !user.mfaRecoveryCodeHashes.includes(where.mfaRecoveryCodeHashes.has)
        ) return { count: 0 };
        apply(data);
        return { count: 1 };
      }),
    },
  };
  return { user, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: mock.prisma }));

import {
  confirmMfaEnrollment,
  generateTotp,
  startMfaEnrollment,
  verifyUserMfaChallenge,
} from "@/lib/mfa";

describe("MFA enrollment and recovery", () => {
  beforeEach(() => {
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64url");
    Object.assign(mock.user, {
      mfaEnabled: false,
      mfaSecretCiphertext: null,
      mfaPendingSecretCiphertext: null,
      mfaRecoveryCodeHashes: [],
      mfaEnrolledAt: null,
      authVersion: 0,
    });
    vi.clearAllMocks();
  });

  it("encrypts the TOTP secret and stores only recovery-code hashes", async () => {
    const enrollment = await startMfaEnrollment(mock.user.id, mock.user.email);
    expect(mock.user.mfaPendingSecretCiphertext).toMatch(/^v1\./);
    expect(mock.user.mfaPendingSecretCiphertext).not.toContain(enrollment.secret);

    const result = await confirmMfaEnrollment(
      mock.user.id,
      generateTotp(enrollment.secret),
    );
    expect(mock.user.mfaEnabled).toBe(true);
    expect(mock.user.mfaSecretCiphertext).toMatch(/^v1\./);
    expect(result.recoveryCodes).toHaveLength(8);
    expect(mock.user.mfaRecoveryCodeHashes).toHaveLength(8);
    expect(mock.user.mfaRecoveryCodeHashes).not.toContain(result.recoveryCodes[0]);
  });

  it("consumes a recovery code exactly once and revokes older sessions", async () => {
    const enrollment = await startMfaEnrollment(mock.user.id, mock.user.email);
    const { recoveryCodes } = await confirmMfaEnrollment(
      mock.user.id,
      generateTotp(enrollment.secret),
    );
    const before = mock.user.authVersion;

    const first = await verifyUserMfaChallenge(mock.user.id, recoveryCodes[0]);
    const second = await verifyUserMfaChallenge(mock.user.id, recoveryCodes[0]);

    expect(first).toMatchObject({ verified: true, usedRecoveryCode: true, authVersion: before + 1 });
    expect(second.verified).toBe(false);
    expect(mock.user.mfaRecoveryCodeHashes).toHaveLength(7);
  });
});
