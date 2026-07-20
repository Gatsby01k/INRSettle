import "dotenv/config";

import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";

import { loadConfig, type GatewayConfig } from "./config.js";
import {
  getPayoutStatus,
  loginOrThrow,
  sendPayoutRequest,
  verifyWebhookSignature,
  type PontisPayoutRequest,
} from "./pontis.js";

/**
 * Standalone PontisGlobe gateway.
 *
 * PontisGlobe whitelists this VPS's static IP, so the INRSettle app on Vercel
 * MUST NOT call Pontis directly. Instead Vercel calls this gateway, which holds
 * the Pontis credentials and signs every request. Inbound requests authenticate
 * with the shared secret in the `x-inrsettle-gateway-secret` header.
 *
 *   POST /health          — liveness check (no auth)
 *   POST /pontis/payout   — login + sendPayoutRequest (auth required)
 *   POST /pontis/status   — login + getPayoutStatus (auth required)
 *   POST /pontis/webhook  — verify Pontis HMAC + forward to INRSettle app
 */

export const GATEWAY_SECRET_HEADER = "x-inrsettle-gateway-secret";
const GATEWAY_WEBHOOK_TIMESTAMP_HEADER = "x-inrsettle-gateway-timestamp";
const GATEWAY_WEBHOOK_SIGNATURE_HEADER = "x-inrsettle-gateway-signature";

const config: GatewayConfig = loadConfig();
const app = express();

/** Constant-time comparison of the inbound gateway secret. */
function verifyGatewaySecret(provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(config.gatewaySecret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireSecret(req: Request, res: Response, next: NextFunction): void {
  const provided = req.header(GATEWAY_SECRET_HEADER) ?? undefined;
  if (!verifyGatewaySecret(provided)) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }
  next();
}

/** Narrow check that an inbound payout body has the required Pontis fields. */
function parsePayoutRequest(body: unknown): PontisPayoutRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const recipient = b.recipient_details as Record<string, unknown> | undefined;

  const stringFields = [
    "idempotency_key",
    "country_code",
    "currency_code",
    "payment_method",
    "source_amount",
    "source_currency",
  ] as const;
  for (const field of stringFields) {
    if (typeof b[field] !== "string" || !(b[field] as string).length) return null;
  }

  if (
    !recipient ||
    typeof recipient.name !== "string" ||
    typeof recipient.account_number !== "string"
  ) {
    return null;
  }

  return body as PontisPayoutRequest;
}

function parseWebhookPayload(rawBody: string): {
  transaction_id: string;
  status: string;
  status_message?: string | null;
} | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const finalStatuses = new Set(["completed", "failed", "reversed", "rejected", "canceled"]);
  if (
    typeof value.transaction_id !== "string" ||
    !value.transaction_id.length ||
    typeof value.status !== "string" ||
    !finalStatuses.has(value.status) ||
    (value.status_message !== undefined &&
      value.status_message !== null &&
      typeof value.status_message !== "string")
  ) {
    return null;
  }
  return value as {
    transaction_id: string;
    status: string;
    status_message?: string | null;
  };
}

function signAppWebhook(timestamp: string, rawBody: string): string {
  const digest = crypto
    .createHmac("sha256", config.appWebhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `sha256=${digest}`;
}

app.post("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "pontis-gateway", time: new Date().toISOString() });
});

// This route must run before express.json(): Pontis signs the exact raw bytes.
app.post(
  "/pontis/webhook",
  express.text({ type: "*/*", limit: "256kb" }),
  async (req: Request, res: Response) => {
    const rawBody = typeof req.body === "string" ? req.body : "";
    const providerTimestamp = req.header("x-pontis-timestamp") ?? "";
    const providerSignature = req.header("x-pontis-signature") ?? "";
    const eventId = req.header("x-pontis-event-id") ?? "";

    if (!providerTimestamp || !providerSignature) {
      res.status(400).json({ ok: false, error: "Missing Pontis webhook signature headers." });
      return;
    }
    if (!verifyWebhookSignature(config.pontis, providerTimestamp, providerSignature, rawBody)) {
      res.status(401).json({ ok: false, error: "Invalid Pontis webhook signature." });
      return;
    }
    if (!parseWebhookPayload(rawBody)) {
      res.status(400).json({ ok: false, error: "Unexpected Pontis webhook payload." });
      return;
    }

    const gatewayTimestamp = String(Math.floor(Date.now() / 1000));
    try {
      const response = await fetch(config.appWebhookUrl, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          "content-type": "application/json",
          [GATEWAY_WEBHOOK_TIMESTAMP_HEADER]: gatewayTimestamp,
          [GATEWAY_WEBHOOK_SIGNATURE_HEADER]: signAppWebhook(gatewayTimestamp, rawBody),
          ...(eventId ? { "x-pontis-event-id": eventId } : {}),
        },
        body: rawBody,
      });
      const responseText = await response.text();
      if (!response.ok) {
        console.error(
          `[pontis-gateway] app webhook callback failed (${response.status}): ${responseText.slice(0, 500)}`,
        );
        res.status(502).json({ ok: false, error: "INRSettle webhook callback rejected the event." });
        return;
      }
      res.json({ ok: true, received: true, forwarded: true });
    } catch (error) {
      console.error("[pontis-gateway] app webhook callback unavailable:", error);
      res.status(502).json({ ok: false, error: "INRSettle webhook callback is unavailable." });
    }
  },
);

app.use(express.json({ limit: "256kb" }));

app.post("/pontis/payout", requireSecret, async (req: Request, res: Response) => {
  const payout = parsePayoutRequest(req.body);
  if (!payout) {
    res.status(400).json({ ok: false, error: "Invalid payout request body." });
    return;
  }

  try {
    const jwt = await loginOrThrow(config.pontis);
    const result = await sendPayoutRequest(config.pontis, payout, jwt);
    const data = result.data?.data ?? null;

    res.status(result.ok ? 200 : 502).json({
      ok: result.ok && Boolean(data?.transaction_id),
      transaction_id: data?.transaction_id ?? null,
      status: data?.status ?? null,
      status_message: data?.status_message ?? null,
      provider_response: result.data,
      error: result.ok
        ? null
        : ((result.data?.error as { message?: string } | undefined)?.message ??
          `PontisGlobe rejected the payout (HTTP ${result.status}).`),
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Gateway error.",
    });
  }
});

app.post("/pontis/status", requireSecret, async (req: Request, res: Response) => {
  const transactionId = (req.body as { transaction_id?: unknown } | undefined)?.transaction_id;
  if (typeof transactionId !== "string" || !transactionId.length) {
    res.status(400).json({ ok: false, error: "transaction_id is required." });
    return;
  }

  try {
    const jwt = await loginOrThrow(config.pontis);
    const result = await getPayoutStatus(config.pontis, transactionId, jwt);
    const data = result.data?.data ?? null;

    res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      transaction_id: transactionId,
      status: data?.status ?? null,
      status_message: data?.status_message ?? null,
      provider_response: result.data,
      error: result.ok
        ? null
        : `PontisGlobe could not return the status (HTTP ${result.status}).`,
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Gateway error.",
    });
  }
});

app.listen(config.port, () => {
  console.log(`[pontis-gateway] listening on port ${config.port}`);
});
