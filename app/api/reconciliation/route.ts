import { NextRequest, NextResponse } from "next/server";
import { createReconciliationRecord } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { requireApiContext } from "@/lib/api";
import { beginApiIdempotency, completeApiIdempotency } from "@/lib/api-idempotency";
import { friendlyErrorMessage } from "@/lib/errors";
import { canWriteReconciliation, roleErrorMessage } from "@/lib/permissions";

export async function GET() {
  const { context, error } = await requireApiContext({ serviceScope: "reconciliation:read" });
  if (error) return error;

  const records = await prisma.reconciliationRecord.findMany({
    where: { organizationId: context.organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const { context, error } = await requireApiContext({ serviceScope: "reconciliation:write" });
  if (error) return error;
  if (!canWriteReconciliation(context.membership.role)) {
    return NextResponse.json({ error: roleErrorMessage(context.membership.role) }, { status: 403 });
  }

  const input = await request.json();
  const idempotency = await beginApiIdempotency(context, "POST /api/reconciliation", input);
  if (idempotency.mode === "replay") return idempotency.response;
  try {
    const record = await createReconciliationRecord(input, context.user.id, context.organization.id);
    const body = JSON.parse(JSON.stringify({ data: record }));
    await completeApiIdempotency(idempotency, 201, body);
    return NextResponse.json(body, { status: 201 });
  } catch (err) {
    const body = { error: friendlyErrorMessage(err) };
    await completeApiIdempotency(idempotency, 400, body);
    return NextResponse.json(body, { status: 400 });
  }
}
