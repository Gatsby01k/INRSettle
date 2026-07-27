import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiContext } from "@/lib/api";
import { createApiCredentialToken } from "@/lib/api-credentials";
import { writeAuditLog } from "@/lib/audit";
import { isMfaStepUpFresh } from "@/lib/auth";
import { approvalMfaViolation, canManageSettings, roleErrorMessage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const ALLOWED_SCOPES = [
  "quotes:read",
  "quotes:write",
  "settlements:read",
  "settlements:write",
  "funding:read",
  "reconciliation:read",
  "reconciliation:write",
  "finality:read",
  "reports:read",
] as const;

const createSchema = z.object({
  name: z.string().trim().min(3).max(100),
  role: z.enum([Role.FINANCE_VIEWER, Role.SETTLEMENT_OPERATOR]),
  scopes: z.array(z.enum(ALLOWED_SCOPES)).min(1),
  expiresAt: z.coerce.date().min(new Date()).optional(),
});

const revokeSchema = z.object({ id: z.string().cuid() });

async function requireCredentialAdministrator() {
  const result = await requireApiContext();
  if (result.error) return result;
  if (!canManageSettings(result.context.membership.role)) {
    return {
      error: NextResponse.json(
        { error: roleErrorMessage(result.context.membership.role) },
        { status: 403 },
      ),
    };
  }
  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId: result.context.organization.id },
  });
  const violation = approvalMfaViolation({
    requireMfaForApproval: settings?.requireMfaForApproval ?? true,
    mfaEnabled: result.context.user.mfaEnabled,
    mfaStepUpFresh: isMfaStepUpFresh(result.context.session),
  });
  if (violation) {
    return { error: NextResponse.json({ error: violation }, { status: 403 }) };
  }
  return result;
}

export async function GET() {
  const { context, error } = await requireApiContext();
  if (error) return error;
  if (!canManageSettings(context.membership.role)) {
    return NextResponse.json({ error: roleErrorMessage(context.membership.role) }, { status: 403 });
  }

  const credentials = await prisma.apiCredential.findMany({
    where: { organizationId: context.organization.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      role: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ data: credentials });
}

export async function POST(request: NextRequest) {
  const { context, error } = await requireCredentialAdministrator();
  if (error) return error;

  try {
    const input = createSchema.parse(await request.json());
    const generated = createApiCredentialToken();
    const credential = await prisma.$transaction(async (tx) => {
      const created = await tx.apiCredential.create({
        data: {
          organizationId: context.organization.id,
          name: input.name,
          keyPrefix: generated.keyPrefix,
          secretHash: generated.secretHash,
          role: input.role,
          scopes: input.scopes,
          expiresAt: input.expiresAt,
          createdById: context.user.id,
        },
      });
      await writeAuditLog({
        action: "api_credential.created",
        resourceType: "api_credential",
        resourceId: created.id,
        organizationId: context.organization.id,
        userId: context.user.id,
        after: {
          name: created.name,
          keyPrefix: created.keyPrefix,
          role: created.role,
          scopes: created.scopes,
          expiresAt: created.expiresAt,
        },
      }, tx);
      return created;
    });

    return NextResponse.json(
      {
        data: {
          id: credential.id,
          name: credential.name,
          keyPrefix: credential.keyPrefix,
          token: generated.token,
          scopes: credential.scopes,
          expiresAt: credential.expiresAt,
        },
      },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (credentialError) {
    return jsonError(credentialError);
  }
}

export async function DELETE(request: NextRequest) {
  const { context, error } = await requireCredentialAdministrator();
  if (error) return error;

  try {
    const input = revokeSchema.parse(await request.json());
    const existing = await prisma.apiCredential.findFirst({
      where: { id: input.id, organizationId: context.organization.id },
    });
    if (!existing) return NextResponse.json({ error: "API credential was not found." }, { status: 404 });
    if (existing.revokedAt) return NextResponse.json({ data: { id: existing.id, revoked: true } });

    await prisma.$transaction(async (tx) => {
      await tx.apiCredential.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      await writeAuditLog({
        action: "api_credential.revoked",
        resourceType: "api_credential",
        resourceId: existing.id,
        organizationId: context.organization.id,
        userId: context.user.id,
        before: { revokedAt: null },
        after: { revokedAt: new Date(), keyPrefix: existing.keyPrefix },
      }, tx);
    });
    return NextResponse.json({ data: { id: existing.id, revoked: true } });
  } catch (credentialError) {
    return jsonError(credentialError);
  }
}
