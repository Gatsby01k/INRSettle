import { NextRequest, NextResponse } from "next/server";
import { createSettlement } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { requireApiContext } from "@/lib/api";
import { beginApiIdempotency, completeApiIdempotency } from "@/lib/api-idempotency";
import { friendlyErrorMessage } from "@/lib/errors";
import {
  canCreateSettlement,
  canViewSensitiveFinancialData,
  roleErrorMessage,
} from "@/lib/permissions";
import { maskFinancialIdentifier } from "@/lib/utils";

export async function GET() {
  const { context, error } = await requireApiContext({ serviceScope: "settlements:read" });
  if (error) return error;

  const settlements = await prisma.settlement.findMany({
    where: { organizationId: context.organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { quote: true, events: { orderBy: { createdAt: "desc" } } },
  });

  const canViewSensitive = canViewSensitiveFinancialData(context.membership.role);
  return NextResponse.json({
    data: settlements.map((settlement) => ({
      ...settlement,
      sourceAccount: canViewSensitive
        ? settlement.sourceAccount
        : maskFinancialIdentifier(settlement.sourceAccount),
      targetAccount: canViewSensitive
        ? settlement.targetAccount
        : maskFinancialIdentifier(settlement.targetAccount),
    })),
  });
}

export async function POST(request: NextRequest) {
  const { context, error } = await requireApiContext({ serviceScope: "settlements:write" });
  if (error) return error;
  if (!canCreateSettlement(context.membership.role)) {
    return NextResponse.json({ error: roleErrorMessage(context.membership.role) }, { status: 403 });
  }

  const input = await request.json();
  const idempotency = await beginApiIdempotency(context, "POST /api/settlements", input);
  if (idempotency.mode === "replay") return idempotency.response;
  try {
    const settlement = await createSettlement(input, context.user.id, context.organization.id);
    const body = JSON.parse(JSON.stringify({ data: settlement }));
    await completeApiIdempotency(idempotency, 201, body);
    return NextResponse.json(body, { status: 201 });
  } catch (err) {
    const body = { error: friendlyErrorMessage(err) };
    await completeApiIdempotency(idempotency, 400, body);
    return NextResponse.json(body, { status: 400 });
  }
}
