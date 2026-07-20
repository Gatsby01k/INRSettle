import { NextRequest, NextResponse } from "next/server";
import { AuditActorType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  GATEWAY_WEBHOOK_SIGNATURE_HEADER,
  GATEWAY_WEBHOOK_TIMESTAMP_HEADER,
  verifyGatewayWebhookSignature,
} from "@/lib/providers/pontis/gateway";
import { webhookPayloadSchema } from "@/lib/providers/pontis/schema";
import { resolvePayoutByTransaction } from "@/lib/providers/pontis/settlement";
import { beginVerifiedWebhook, finishWebhook } from "@/lib/providers/webhook-inbox";

export const runtime = "nodejs";

/**
 * POST /api/providers/pontis/webhook
 *
 * Internal endpoint called by the static-IP Pontis gateway after that gateway
 * verifies the provider HMAC. PontisGlobe must call `/pontis/webhook` on the
 * gateway, not this application route directly.
 *
 * The gateway re-signs the exact raw bytes with a separate internal secret and
 * sends x-inrsettle-gateway-timestamp / x-inrsettle-gateway-signature. Provider
 * API/HMAC credentials therefore remain on the gateway host.
 *
 * Always responds 2xx for authentic, processed (and duplicate) deliveries; the
 * provider does not retry, so we acknowledge and fall back to polling on misses.
 *
 * Docs: https://docs.pontisglobe.com/callbacks
 */

export async function POST(request: NextRequest) {
  // Read the raw body exactly as received — required for gateway signature verification.
  const rawBody = await request.text().catch(() => "");

  const timestamp = request.headers.get(GATEWAY_WEBHOOK_TIMESTAMP_HEADER) ?? "";
  const signature = request.headers.get(GATEWAY_WEBHOOK_SIGNATURE_HEADER) ?? "";
  const eventId = request.headers.get("x-pontis-event-id") ?? "";

  if (!timestamp || !signature) {
    await auditVerificationFailure("missing_signature_headers");
    return NextResponse.json({ error: "Missing webhook signature headers." }, { status: 400 });
  }

  if (!verifyGatewayWebhookSignature(timestamp, signature, rawBody)) {
    await auditVerificationFailure("invalid_signature");
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let parsed: ReturnType<typeof webhookPayloadSchema.safeParse>;
  try {
    parsed = webhookPayloadSchema.safeParse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Malformed webhook payload." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json({ error: "Unexpected webhook payload." }, { status: 400 });
  }

  const { transaction_id, status, status_message } = parsed.data;

  let inbox: Awaited<ReturnType<typeof beginVerifiedWebhook>>;
  try {
    inbox = await beginVerifiedWebhook({
      providerCode: "pontis",
      eventKey: eventId,
      rawPayload: rawBody,
      payload: parsed.data,
    });
  } catch {
    return NextResponse.json({ error: "Webhook inbox unavailable." }, { status: 503 });
  }
  if (inbox.duplicate) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Map the provider transaction back to its settlement and apply the outcome
  // (EXECUTING -> SETTLED / FAILED). Idempotent: re-deliveries / already-resolved
  // settlements are safely ignored. We still acknowledge with 2xx regardless so
  // the provider marks delivery successful and does not retry.
  let resolution = null;
  try {
    resolution = await resolvePayoutByTransaction(transaction_id, status, status_message ?? null);
    await finishWebhook(inbox.event.id, resolution === null ? "IGNORED" : "PROCESSED", {
      organizationId: resolution?.organizationId ?? null,
    });
  } catch (error) {
    console.error("[pontis.webhook] failed to resolve settlement:", error);
    // Audit the miss so it is visible to operators (safe message only — no
    // credentials, no raw payload). Never throw: keep the 2xx ACK and rely on
    // the status-poll fallback to recover.
    try {
      await finishWebhook(inbox.event.id, "FAILED", {
        errorMessage: error instanceof Error ? error.message : "resolution failed",
      });
      await writeAuditLog({
        action: "webhook.resolution_failed",
        resourceType: "provider",
        resourceId: "PontisGlobe",
        actorType: AuditActorType.SYSTEM,
        after: {
          provider: "PontisGlobe",
          transactionId: transaction_id,
          status,
          message: error instanceof Error ? error.message : "resolution failed",
        },
      });
    } catch {
      // Best-effort audit; the console error above remains the last resort.
    }
  }

  return NextResponse.json({
    received: true,
    handled: resolution !== null,
    transaction_id,
    status,
    status_message: status_message ?? null,
  });
}

/**
 * Best-effort audit of a webhook delivery that failed verification. The
 * payload is UNVERIFIED at this point, so nothing from the request body or
 * headers is recorded — only the rejection reason (no secrets, no
 * attacker-controlled data). Never throws; the HTTP rejection still stands.
 */
async function auditVerificationFailure(reason: "missing_signature_headers" | "invalid_signature") {
  try {
    await writeAuditLog({
      action: "webhook.verification_failed",
      resourceType: "provider",
      resourceId: "PontisGlobe",
      actorType: AuditActorType.SYSTEM,
      after: { provider: "PontisGlobe", channel: "gateway_callback", reason },
    });
  } catch (error) {
    console.error("[pontis.webhook] failed to audit verification failure:", error);
  }
}
