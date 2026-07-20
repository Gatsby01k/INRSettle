import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { canViewSensitiveFinancialData } from "@/lib/permissions";
import { maskFinancialIdentifier } from "@/lib/utils";

type ReportType = "settlement" | "reconciliation" | "audit";
type ReportFormat = "csv" | "json";

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(","));
  }
  return lines.join("\n");
}

async function buildRows(
  type: ReportType,
  organizationId: string,
  canViewSensitive: boolean,
): Promise<Record<string, unknown>[]> {
  if (type === "settlement") {
    const settlements = await prisma.settlement.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return settlements.map((s) => ({
      publicId: s.publicId,
      reference: s.reference,
      corridor: s.corridor,
      status: s.status,
      sourceAmount: s.sourceAmount.toString(),
      sourceCurrency: s.sourceCurrency,
      targetAmount: s.targetAmount.toString(),
      targetCurrency: s.targetCurrency,
      feeAmount: s.feeAmount.toString(),
      createdAt: s.createdAt.toISOString(),
      settledAt: s.settledAt?.toISOString() ?? "",
      reconciledAt: s.reconciledAt?.toISOString() ?? "",
    }));
  }

  if (type === "reconciliation") {
    const records = await prisma.reconciliationRecord.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return records.map((r) => ({
      externalRef: r.externalRef,
      source: r.source,
      status: r.status,
      amount: r.amount.toString(),
      currency: r.currency,
      valueDate: r.valueDate.toISOString(),
      settlementId: r.settlementId ?? "",
      exceptionReason: r.exceptionReason ?? "",
      createdAt: r.createdAt.toISOString(),
    }));
  }

  const logs = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { user: true },
  });
  return logs.map((log) => ({
    createdAt: log.createdAt.toISOString(),
    action: log.action,
    actor: log.user?.email
      ? (canViewSensitive ? log.user.email : maskFinancialIdentifier(log.user.email))
      : log.actorType,
    resourceType: log.resourceType,
    resourceId: log.resourceId ?? "",
    requestId: log.requestId ?? "",
  }));
}

export async function GET(request: Request) {
  const { context, error } = await requireApiContext();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "settlement") as ReportType;
  const format = (searchParams.get("format") ?? "csv") as ReportFormat;

  if (!["settlement", "reconciliation", "audit"].includes(type)) {
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }
  if (!["csv", "json"].includes(format)) {
    return NextResponse.json({ error: "Unknown report format" }, { status: 400 });
  }

  const rows = await buildRows(
    type,
    context.organization.id,
    canViewSensitiveFinancialData(context.membership.role),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `inrsettle_${type}_report_${stamp}.${format}`;

  await writeAuditLog({
    action: "report.exported",
    resourceType: "report",
    resourceId: `${type}:${stamp}`,
    organizationId: context.organization.id,
    userId: context.user.id,
    after: { type, format, rowCount: rows.length },
  });

  const downloadHeaders = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };

  if (format === "json") {
    return new NextResponse(JSON.stringify({ type, generatedAt: new Date().toISOString(), rows }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        ...downloadHeaders,
      },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      ...downloadHeaders,
    },
  });
}
