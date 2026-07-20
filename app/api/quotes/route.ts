import { NextRequest, NextResponse } from "next/server";
import { createQuote } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { jsonError, requireApiContext } from "@/lib/api";
import { canCreateQuote, roleErrorMessage } from "@/lib/permissions";

export async function GET() {
  const { context, error } = await requireApiContext();
  if (error) return error;

  const quotes = await prisma.quote.findMany({
    where: { organizationId: context.organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: quotes });
}

export async function POST(request: NextRequest) {
  const { context, error } = await requireApiContext();
  if (error) return error;
  if (!canCreateQuote(context.membership.role)) {
    return NextResponse.json({ error: roleErrorMessage(context.membership.role) }, { status: 403 });
  }

  try {
    const quote = await createQuote(await request.json(), context.user.id, context.organization.id);
    return NextResponse.json({ data: quote }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
