import "server-only";

import crypto from "node:crypto";
import { UserFacingError } from "@/lib/errors";

const AAD = Buffer.from("inrsettle:settlement-instruction:v1");

function dataKey(): Buffer {
  const encoded = process.env.SETTLEMENT_DATA_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new UserFacingError(
      "Settlement instructions are unavailable because SETTLEMENT_DATA_ENCRYPTION_KEY is not configured.",
    );
  }
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32) {
    throw new UserFacingError(
      "SETTLEMENT_DATA_ENCRYPTION_KEY must be base64url and decode to exactly 32 bytes.",
    );
  }
  return key;
}

export function encryptSettlementData(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey(), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSettlementData<T>(value: string): T {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new UserFacingError("Stored settlement instructions cannot be read.");
  }
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      dataKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError("Stored settlement instructions failed integrity verification.");
  }
}
