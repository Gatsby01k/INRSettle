import { Prisma, ProviderConnectionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiContext } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canManageSettings, roleErrorMessage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { providerCatalog } from "@/lib/providers/registry";

const SECRET_REFERENCE_PREFIXES = [
  "env://",
  "vault://",
  "aws-secrets://",
  "gcp-secrets://",
  "azure-keyvault://",
] as const;

const connectionSchema = z.object({
  providerCode: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(120).optional(),
  status: z.nativeEnum(ProviderConnectionStatus),
  credentialsRef: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => SECRET_REFERENCE_PREFIXES.some((prefix) => value.startsWith(prefix)),
      "credentialsRef must be an opaque secret-manager reference, not credential material.",
    )
    .nullable()
    .optional(),
  configuration: z.record(z.string(), z.unknown()).nullable().optional(),
});

function configurationJson(value: Record<string, unknown> | null | undefined) {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function GET() {
  const { context, error } = await requireApiContext();
  if (error) return error;

  const connections = await prisma.providerConnection.findMany({
    where: { organizationId: context.organization.id },
    orderBy: { providerCode: "asc" },
    select: {
      id: true,
      providerCode: true,
      displayName: true,
      status: true,
      credentialsRef: true,
      configuration: true,
      capabilities: true,
      lastHealthAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Never return the secret reference itself to a general read endpoint. It
  // may reveal infrastructure naming even though it is not secret material.
  return NextResponse.json({
    data: connections.map(({ credentialsRef, ...connection }) => ({
      ...connection,
      credentialsConfigured: Boolean(credentialsRef),
    })),
  });
}

export async function PUT(request: NextRequest) {
  const { context, error } = await requireApiContext();
  if (error) return error;
  if (!canManageSettings(context.membership.role)) {
    return NextResponse.json({ error: roleErrorMessage(context.membership.role) }, { status: 403 });
  }

  try {
    const input = connectionSchema.parse(await request.json());
    const catalogEntry = providerCatalog().find((entry) => entry.code === input.providerCode);
    if (!catalogEntry) {
      return NextResponse.json(
        { error: `No connector is registered for provider ${input.providerCode}.` },
        { status: 400 },
      );
    }

    const before = await prisma.providerConnection.findUnique({
      where: {
        organizationId_providerCode: {
          organizationId: context.organization.id,
          providerCode: input.providerCode,
        },
      },
    });
    const activationRequested =
      input.status === ProviderConnectionStatus.INTEGRATION_VERIFIED ||
      input.status === ProviderConnectionStatus.COMMERCIAL_READY;
    if (activationRequested && !catalogEntry.configured) {
      return NextResponse.json(
        { error: "The connector deployment configuration must be verified before this connection can be activated." },
        { status: 409 },
      );
    }
    const effectiveCredentialsRef =
      input.credentialsRef === undefined ? before?.credentialsRef ?? null : input.credentialsRef;
    if (
      activationRequested &&
      catalogEntry.credentialStrategy === "tenant_secret_reference" &&
      !effectiveCredentialsRef
    ) {
      return NextResponse.json(
        { error: "A tenant secret-manager reference is required before this connector can be activated." },
        { status: 409 },
      );
    }
    if (input.status === ProviderConnectionStatus.COMMERCIAL_READY) {
      const approvedDueDiligence = await prisma.dueDiligenceCase.findUnique({
        where: {
          organizationId_subjectType_subjectRef: {
            organizationId: context.organization.id,
            subjectType: "PROVIDER",
            subjectRef: input.providerCode,
          },
        },
        select: { status: true },
      });
      if (approvedDueDiligence?.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Approved provider due diligence is required before commercial activation." },
          { status: 409 },
        );
      }
    }

    const connection = await prisma.$transaction(async (tx) => {
      const saved = await tx.providerConnection.upsert({
        where: {
          organizationId_providerCode: {
            organizationId: context.organization.id,
            providerCode: input.providerCode,
          },
        },
        create: {
          organizationId: context.organization.id,
          providerCode: input.providerCode,
          displayName: input.displayName ?? catalogEntry.displayName,
          status: input.status,
          credentialsRef: input.credentialsRef,
          configuration: configurationJson(input.configuration),
          capabilities: [...catalogEntry.capabilities],
        },
        update: {
          displayName: input.displayName ?? catalogEntry.displayName,
          status: input.status,
          credentialsRef: input.credentialsRef,
          configuration: configurationJson(input.configuration),
          capabilities: [...catalogEntry.capabilities],
        },
      });

      await writeAuditLog({
        action: before ? "provider.connection.updated" : "provider.connection.created",
        resourceType: "provider_connection",
        resourceId: saved.id,
        organizationId: context.organization.id,
        userId: context.user.id,
        before: before
          ? {
              providerCode: before.providerCode,
              status: before.status,
              credentialsConfigured: Boolean(before.credentialsRef),
            }
          : undefined,
        after: {
          providerCode: saved.providerCode,
          status: saved.status,
          credentialsConfigured: Boolean(saved.credentialsRef),
          // Intentionally omit credentialsRef and configuration values.
        },
      }, tx);
      return saved;
    });

    return NextResponse.json({
      data: {
        id: connection.id,
        providerCode: connection.providerCode,
        displayName: connection.displayName,
        status: connection.status,
        credentialsConfigured: Boolean(connection.credentialsRef),
        updatedAt: connection.updatedAt,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
