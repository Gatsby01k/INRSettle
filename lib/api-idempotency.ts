import "server-only";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ServiceContext = {
  organization: { id: string };
  apiCredentialId: string | null;
};

type IdempotencyStart =
  | { mode: "session" }
  | { mode: "new"; recordId: string }
  | { mode: "replay"; response: NextResponse };

function hashRequest(body: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export async function beginApiIdempotency(
  context: ServiceContext,
  route: string,
  body: unknown,
): Promise<IdempotencyStart> {
  if (!context.apiCredentialId) return { mode: "session" };
  const key = (await headers()).get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 200) {
    return {
      mode: "replay",
      response: NextResponse.json(
        { error: "Service mutations require an Idempotency-Key header between 8 and 200 characters." },
        { status: 400 },
      ),
    };
  }
  const requestHash = hashRequest(body);
  const existing = await prisma.apiIdempotencyRecord.findUnique({
    where: {
      apiCredentialId_route_key: {
        apiCredentialId: context.apiCredentialId,
        route,
        key,
      },
    },
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      return {
        mode: "replay",
        response: NextResponse.json(
          { error: "The Idempotency-Key was already used with a different request body." },
          { status: 409 },
        ),
      };
    }
    if (existing.responseStatus != null && existing.responseBody != null) {
      return {
        mode: "replay",
        response: NextResponse.json(existing.responseBody, {
          status: existing.responseStatus,
          headers: { "x-idempotent-replay": "true" },
        }),
      };
    }
    return {
      mode: "replay",
      response: NextResponse.json(
        { error: "A request with this Idempotency-Key is still in progress." },
        { status: 409, headers: { "retry-after": "2" } },
      ),
    };
  }

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    const record = await prisma.apiIdempotencyRecord.create({
      data: {
        organizationId: context.organization.id,
        apiCredentialId: context.apiCredentialId,
        key,
        route,
        requestHash,
        expiresAt,
      },
    });
    return { mode: "new", recordId: record.id };
  } catch {
    return {
      mode: "replay",
      response: NextResponse.json(
        { error: "A request with this Idempotency-Key is already being processed." },
        { status: 409, headers: { "retry-after": "2" } },
      ),
    };
  }
}

export async function completeApiIdempotency(
  start: IdempotencyStart,
  status: number,
  body: Prisma.InputJsonValue,
) {
  if (start.mode !== "new") return;
  await prisma.apiIdempotencyRecord.update({
    where: { id: start.recordId },
    data: { responseStatus: status, responseBody: body },
  });
}
