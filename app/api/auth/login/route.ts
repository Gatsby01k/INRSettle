import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  createSession,
  recordAuthenticationFailure,
  recordAuthenticationSuccess,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { verifyUserMfaChallenge } from "@/lib/mfa";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  const mfaCode = String(body.mfaCode ?? "").trim();

  const authenticated = await authenticateUser(email, password);
  if (!authenticated) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { user, membership } = authenticated;
  let authVersion = user.authVersion;
  let mfaVerifiedAt: number | null = null;
  let usedRecoveryCode = false;
  if (user.mfaEnabled) {
    if (!mfaCode) {
      return NextResponse.json({ error: "MFA required", mfaRequired: true }, { status: 202 });
    }
    try {
      const challenge = await verifyUserMfaChallenge(user.id, mfaCode);
      if (!challenge.verified) {
        await recordAuthenticationFailure(user.id);
        return NextResponse.json({ error: "Invalid MFA code", mfaRequired: true }, { status: 401 });
      }
      authVersion = challenge.authVersion;
      usedRecoveryCode = challenge.usedRecoveryCode;
      mfaVerifiedAt = Math.floor(Date.now() / 1000);
    } catch {
      return NextResponse.json({ error: "MFA verification unavailable" }, { status: 503 });
    }
  }
  await createSession(user.id, membership.organizationId, { authVersion, mfaVerifiedAt });
  await recordAuthenticationSuccess(user.id);
  await writeAuditLog({
    action: "auth.login",
    resourceType: "user",
    resourceId: user.id,
    organizationId: membership.organizationId,
    userId: user.id,
    after: { mfaVerified: user.mfaEnabled, usedRecoveryCode },
  });

  return NextResponse.json({ ok: true });
}
