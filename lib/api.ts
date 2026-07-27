import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { OrganizationStatus } from "@prisma/client";
import { getSession, type SessionClaims } from "@/lib/auth";
import { apiSecretMatches, parseApiCredentialToken } from "@/lib/api-credentials";
import { friendlyErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type ApiContextOptions = {
  serviceScope?: string;
};

function authorizationError(message = "Unauthorized", status = 401) {
  return NextResponse.json({ error: message }, { status }) as NextResponse;
}

/**
 * Authenticates either a console session or a scoped service credential.
 * Service credentials are rejected unless the route declares a scope.
 */
export async function requireApiContext(options: ApiContextOptions = {}) {
  const session = await getSession();
  if (session) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.userId,
        organizationId: session.organizationId,
      },
      include: { user: true, organization: true },
    });

    if (
      !membership ||
      membership.organization.status !== OrganizationStatus.ACTIVE ||
      membership.user.authVersion !== session.authVersion
    ) {
      return { error: authorizationError("Forbidden", 403) };
    }

    return {
      context: {
        user: membership.user,
        organization: membership.organization,
        membership,
        session,
        authentication: "session" as const,
        apiCredentialId: null,
      },
    };
  }

  const authorization = (await headers()).get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: authorizationError() };
  }
  if (!options.serviceScope) {
    return { error: authorizationError("Service credentials are not accepted on this route.", 403) };
  }

  const parsed = parseApiCredentialToken(authorization.slice(7).trim());
  if (!parsed) return { error: authorizationError() };
  const credential = await prisma.apiCredential.findUnique({
    where: { keyPrefix: parsed.keyPrefix },
    include: { organization: true, createdBy: true },
  });
  if (
    !credential ||
    credential.revokedAt ||
    (credential.expiresAt && credential.expiresAt <= new Date()) ||
    credential.organization.status !== OrganizationStatus.ACTIVE ||
    !apiSecretMatches(parsed.secret, credential.secretHash)
  ) {
    return { error: authorizationError() };
  }
  if (!credential.scopes.includes(options.serviceScope)) {
    return { error: authorizationError(`Missing required scope: ${options.serviceScope}.`, 403) };
  }

  await prisma.apiCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  const serviceSession: SessionClaims = {
    userId: credential.createdById,
    organizationId: credential.organizationId,
    authVersion: credential.createdBy.authVersion,
    mfaVerifiedAt: null,
  };

  return {
    context: {
      user: credential.createdBy,
      organization: credential.organization,
      membership: { role: credential.role },
      session: serviceSession,
      authentication: "service" as const,
      apiCredentialId: credential.id,
    },
  };
}

export function jsonError(error: unknown) {
  return NextResponse.json({ error: friendlyErrorMessage(error) }, { status: 400 });
}
