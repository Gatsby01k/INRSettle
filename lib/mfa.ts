import "server-only";

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/errors";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;

function encryptionKey(): Buffer {
  const encoded = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new UserFacingError("MFA is unavailable because MFA_ENCRYPTION_KEY is not configured.");
  }
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32) {
    throw new UserFacingError("MFA_ENCRYPTION_KEY must be base64url and decode to exactly 32 bytes.");
  }
  return key;
}

export function encodeBase32(value: Buffer): string {
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    encoded += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return encoded;
}

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new UserFacingError("Stored MFA secret is invalid.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotp(secret: string, timestampMs = Date.now()): string {
  const counter = Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, codeInput: string, nowMs = Date.now()): boolean {
  const code = codeInput.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const expected = generateTotp(secret, nowMs + offset * TOTP_PERIOD_SECONDS * 1000);
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return true;
  }
  return false;
}

function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from("inrsettle:mfa:v1"));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptSecret(value: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new UserFacingError("Stored MFA secret cannot be read.");
  }
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAAD(Buffer.from("inrsettle:mfa:v1"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError("Stored MFA secret failed integrity verification.");
  }
}

function recoveryHash(codeInput: string): string {
  const code = codeInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return crypto.createHmac("sha256", encryptionKey()).update(`recovery:${code}`).digest("hex");
}

function generateRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

export async function startMfaEnrollment(userId: string, email: string) {
  const secret = encodeBase32(crypto.randomBytes(20));
  await prisma.user.update({
    where: { id: userId },
    data: { mfaPendingSecretCiphertext: encryptSecret(secret) },
  });
  const label = encodeURIComponent(`INRSettle:${email}`);
  const issuer = encodeURIComponent("INRSettle");
  return {
    secret,
    otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
  };
}

export async function confirmMfaEnrollment(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaPendingSecretCiphertext) {
    throw new UserFacingError("Start MFA enrollment before confirming a code.");
  }
  const secret = decryptSecret(user.mfaPendingSecretCiphertext);
  if (!verifyTotp(secret, code)) {
    throw new UserFacingError("Invalid authenticator code.");
  }

  const recoveryCodes = generateRecoveryCodes();
  const claimed = await prisma.user.updateMany({
    where: {
      id: userId,
      mfaEnabled: false,
      mfaPendingSecretCiphertext: user.mfaPendingSecretCiphertext,
    },
    data: {
      mfaEnabled: true,
      mfaSecretCiphertext: user.mfaPendingSecretCiphertext,
      mfaPendingSecretCiphertext: null,
      mfaRecoveryCodeHashes: recoveryCodes.map(recoveryHash),
      mfaEnrolledAt: new Date(),
      authVersion: { increment: 1 },
    },
  });
  if (claimed.count !== 1) {
    throw new UserFacingError("MFA enrollment changed concurrently. Start enrollment again.");
  }
  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { authVersion: true },
  });
  if (!updated) throw new UserFacingError("MFA user was not found.");
  return { recoveryCodes, authVersion: updated.authVersion };
}

/**
 * Verify TOTP or consume one recovery code. A consumed recovery code is removed
 * with a conditional update so concurrent reuse cannot authenticate twice.
 */
export async function verifyUserMfaChallenge(userId: string, codeInput: string): Promise<{
  verified: boolean;
  authVersion: number;
  usedRecoveryCode: boolean;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaEnabled || !user.mfaSecretCiphertext) {
    return { verified: false, authVersion: user?.authVersion ?? 0, usedRecoveryCode: false };
  }

  const secret = decryptSecret(user.mfaSecretCiphertext);
  if (verifyTotp(secret, codeInput)) {
    return { verified: true, authVersion: user.authVersion, usedRecoveryCode: false };
  }

  const candidate = recoveryHash(codeInput);
  const index = user.mfaRecoveryCodeHashes.findIndex((stored) => {
    const a = Buffer.from(stored, "hex");
    const b = Buffer.from(candidate, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (index < 0) {
    return { verified: false, authVersion: user.authVersion, usedRecoveryCode: false };
  }

  const remaining = user.mfaRecoveryCodeHashes.filter((_, candidateIndex) => candidateIndex !== index);
  const consumed = await prisma.user.updateMany({
    where: { id: user.id, authVersion: user.authVersion, mfaRecoveryCodeHashes: { has: candidate } },
    data: { mfaRecoveryCodeHashes: { set: remaining }, authVersion: { increment: 1 } },
  });
  if (consumed.count !== 1) {
    return { verified: false, authVersion: user.authVersion, usedRecoveryCode: false };
  }
  return { verified: true, authVersion: user.authVersion + 1, usedRecoveryCode: true };
}

export async function disableMfa(userId: string) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecretCiphertext: null,
      mfaPendingSecretCiphertext: null,
      mfaRecoveryCodeHashes: { set: [] },
      mfaEnrolledAt: null,
      authVersion: { increment: 1 },
    },
    select: { authVersion: true },
  });
  return updated.authVersion;
}
