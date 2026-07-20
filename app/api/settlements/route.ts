import { NextRequest, NextResponse } from "next/server";
import { createSettlement } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiContext } from "@/lib/api";
import {
  canCreateSettlement,
  canViewSensitiveFinancialData,
  roleErrorMessage,
} from "@/lib/permissions";
import { maskFinancialIdentifier } from "@/lib/utils";

export async function GET() {
  const { context, error } = await requireApiContext();
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
  const { context, error } = await requireApiContext();
  if (error) return error;
  if (!canCreateSettlement(context.membership.role)) {
    return NextResponse.json({ error: roleErrorMessage(context.membership.role) }, { status: 403 });
  }

  try {
    const settlement = await createSettlement(await request.json(), context.user.id, context.organization.id);
    return NextResponse.json({ data: settlement }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
