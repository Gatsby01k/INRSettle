import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retryProviderStatusOperation } from "@/lib/providers/service";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const configured = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || configured.length < 32 || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.providerOperation.findMany({
    where: {
      operationType: "STATUS_CHECK",
      status: "FAILED",
      nextRetryAt: { lte: new Date() },
      resolvedAt: null,
    },
    orderBy: { nextRetryAt: "asc" },
    take: 25,
    select: { id: true },
  });

  let processed = 0;
  let succeeded = 0;
  let manualReview = 0;
  for (const item of due) {
    const result = await retryProviderStatusOperation(item.id);
    if (result.processed) processed += 1;
    if ("succeeded" in result && result.succeeded) succeeded += 1;
    if ("manualReview" in result && result.manualReview) manualReview += 1;
  }

  return NextResponse.json({
    examined: due.length,
    processed,
    succeeded,
    manualReview,
  });
}
