import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrganizationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "inrsettle_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const MFA_STEP_UP_TTL_SECONDS = 10 * 60;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;
// Cost-12 dummy hash keeps unknown-account and wrong-password paths closer in
// timing without ever authenticating a real account.
const DUMMY_PASSWORD_HASH = "$2b$12$9.1CQEm1Gozirl3R31DPB.IkLNNMtemwzgRKBq.UCWBtzCAaTAl2K";

export type SessionClaims = {
  userId: string;
  organizationId: string;
  authVersion: number;
  mfaVerifiedAt: number | null;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function recordAuthenticationFailure(userId: string) {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (user.failedLoginCount >= MAX_LOGIN_FAILURES) {
      await tx.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + LOGIN_LOCK_SECONDS * 1000) },
      });
    }
  });
}

export async function recordAuthenticationSuccess(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
}

/**
 * Shared login boundary for both the form action and JSON route. Only an ACTIVE
 * organization may receive a session. Multi-organization selection is not yet
 * implemented, so the oldest active membership remains the deterministic
 * default instead of relying on an unordered `take: 1`.
 */
export async function authenticateUser(emailInput: string, password: string) {
  const email = emailInput.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { organization: { status: OrganizationStatus.ACTIVE } },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!user) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return null;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return null;
  if (!(await verifyPassword(password, user.passwordHash)) || !user.memberships[0]) {
    await recordAuthenticationFailure(user.id);
    return null;
  }

  return { user, membership: user.memberships[0] };
}

export async function createSession(
  userId: string,
  organizationId: string,
  options: { authVersion?: number; mfaVerifiedAt?: number | null } = {},
) {
  const token = await new SignJWT({
    userId,
    organizationId,
    authVersion: options.authVersion ?? 0,
    mfaVerifiedAt: options.mfaVerifiedAt ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = String(payload.userId ?? "");
    const organizationId = String(payload.organizationId ?? "");
    if (!userId || !organizationId) return null;
    const authVersion = Number(payload.authVersion ?? 0);
    const mfaVerifiedAt = payload.mfaVerifiedAt == null ? null : Number(payload.mfaVerifiedAt);
    if (!Number.isInteger(authVersion) || authVersion < 0) return null;
    if (mfaVerifiedAt !== null && (!Number.isFinite(mfaVerifiedAt) || mfaVerifiedAt <= 0)) return null;
    return { userId, organizationId, authVersion, mfaVerifiedAt };
  } catch {
    return null;
  }
}

export function isMfaStepUpFresh(session: Pick<SessionClaims, "mfaVerifiedAt">, nowMs = Date.now()) {
  if (!session.mfaVerifiedAt) return false;
  const age = Math.floor(nowMs / 1000) - session.mfaVerifiedAt;
  return age >= 0 && age <= MFA_STEP_UP_TTL_SECONDS;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      organizationId: session.organizationId,
    },
    include: {
      user: true,
      organization: {
        include: {
          settings: true,
        },
      },
    },
  });

  if (
    !membership ||
    membership.organization.status !== OrganizationStatus.ACTIVE ||
    membership.user.authVersion !== session.authVersion
  ) {
    await clearSession();
    redirect("/login");
  }

  return {
    user: membership.user,
    organization: membership.organization,
    membership,
    session,
  };
}
