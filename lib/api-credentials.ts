import "server-only";

import crypto from "node:crypto";

const TOKEN_PREFIX = "inrs_live";

function pepper() {
  const value = process.env.API_KEY_PEPPER?.trim();
  if (!value || value.length < 32) {
    throw new Error("API_KEY_PEPPER must be configured with at least 32 characters.");
  }
  return value;
}

export function hashApiSecret(secret: string) {
  return crypto.createHash("sha256").update(`${secret}:${pepper()}`).digest("hex");
}

export function createApiCredentialToken() {
  const keyPrefix = crypto.randomBytes(6).toString("hex");
  const secret = crypto.randomBytes(32).toString("base64url");
  return {
    keyPrefix,
    secretHash: hashApiSecret(secret),
    token: `${TOKEN_PREFIX}_${keyPrefix}.${secret}`,
  };
}

export function parseApiCredentialToken(token: string) {
  const match = token.match(/^inrs_live_([a-f0-9]{12})\.([A-Za-z0-9_-]{40,})$/);
  if (!match) return null;
  return { keyPrefix: match[1], secret: match[2] };
}

export function apiSecretMatches(secret: string, expectedHash: string) {
  const actual = Buffer.from(hashApiSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
