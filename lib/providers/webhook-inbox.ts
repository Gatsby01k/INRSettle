import "server-only";

import crypto from "node:crypto";
import { Prisma, ProviderWebhookStatus, type ProviderWebhookEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redactProviderPayload } from "@/lib/providers/redaction";

type BeginWebhookInput = {
  providerCode: string;
  eventKey?: string | null;
  rawPayload: string;
  payload?: unknown;
  organizationId?: string | null;
  providerConnectionId?: string | null;
};

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(redactProviderPayload(value))) as Prisma.InputJsonValue;
}

export function webhookPayloadHash(rawPayload: string): string {
  return crypto.createHash("sha256").update(rawPayload).digest("hex");
}

/**
 * Durable inbox insert after signature verification. The provider event id is
 * preferred; providers without one use the payload hash. The unique database
 * key, not process memory, makes retries idempotent across replicas/restarts.
 */
export async function beginVerifiedWebhook(input: BeginWebhookInput): Promise<{
  event: ProviderWebhookEvent;
  duplicate: boolean;
}> {
  const payloadHash = webhookPayloadHash(input.rawPayload);
  const eventKey = input.eventKey?.trim() || payloadHash;

  try {
    const event = await prisma.providerWebhookEvent.create({
      data: {
        organizationId: input.organizationId ?? null,
        providerConnectionId: input.providerConnectionId ?? null,
        providerCode: input.providerCode,
        eventKey,
        signatureValid: true,
        status: ProviderWebhookStatus.RECEIVED,
        payloadHash,
        payload: asJson(input.payload),
      },
    });
    return { event, duplicate: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const event = await prisma.providerWebhookEvent.findUnique({
        where: { providerCode_eventKey: { providerCode: input.providerCode, eventKey } },
      });
      if (event) return { event, duplicate: true };
    }
    throw error;
  }
}

export async function finishWebhook(
  id: string,
  status: "PROCESSED" | "IGNORED" | "FAILED",
  options: { organizationId?: string | null; errorMessage?: string | null } = {},
) {
  return prisma.providerWebhookEvent.update({
    where: { id },
    data: {
      status,
      organizationId: options.organizationId ?? undefined,
      errorMessage: options.errorMessage?.slice(0, 1000) ?? null,
      processedAt: new Date(),
    },
  });
}
