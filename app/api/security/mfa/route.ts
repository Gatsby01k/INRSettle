import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext, jsonError } from "@/lib/api";
import {
  createSession,
  recordAuthenticationFailure,
  verifyPassword,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  confirmMfaEnrollment,
  disableMfa,
  startMfaEnrollment,
  verifyUserMfaChallenge,
} from "@/lib/mfa";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll_start") }),
  z.object({ action: z.literal("enroll_confirm"), code: z.string().trim().min(6).max(32) }),
  z.object({ action: z.literal("step_up"), code: z.string().trim().min(6).max(32) }),
  z.object({
    action: z.literal("disable"),
    code: z.string().trim().min(6).max(32),
    password: z.string().min(1).max(256),
  }),
]);

export async function POST(request: NextRequest) {
  const { context, error } = await requireApiContext();
  if (error) return error;

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch (parseError) {
    return jsonError(parseError);
  }

  try {
    if (parsed.action === "enroll_start") {
      if (context.user.mfaEnabled) {
        return NextResponse.json({ error: "MFA is already enabled." }, { status: 409 });
      }
      const enrollment = await startMfaEnrollment(context.user.id, context.user.email);
      await writeAuditLog({
        action: "auth.mfa_enrollment_started",
        resourceType: "user",
        resourceId: context.user.id,
        organizationId: context.organization.id,
        userId: context.user.id,
      });
      return NextResponse.json(enrollment, { headers: { "cache-control": "no-store" } });
    }

    if (parsed.action === "enroll_confirm") {
      const result = await confirmMfaEnrollment(context.user.id, parsed.code);
      await createSession(context.user.id, context.organization.id, {
        authVersion: result.authVersion,
        mfaVerifiedAt: Math.floor(Date.now() / 1000),
      });
      await writeAuditLog({
        action: "auth.mfa_enabled",
        resourceType: "user",
        resourceId: context.user.id,
        organizationId: context.organization.id,
        userId: context.user.id,
        after: { recoveryCodeCount: result.recoveryCodes.length },
      });
      return NextResponse.json(
        { ok: true, recoveryCodes: result.recoveryCodes },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const challenge = await verifyUserMfaChallenge(context.user.id, parsed.code);
    if (!challenge.verified) {
      await recordAuthenticationFailure(context.user.id);
      return NextResponse.json({ error: "Invalid authenticator or recovery code." }, { status: 401 });
    }

    if (parsed.action === "step_up") {
      await createSession(context.user.id, context.organization.id, {
        authVersion: challenge.authVersion,
        mfaVerifiedAt: Math.floor(Date.now() / 1000),
      });
      await writeAuditLog({
        action: "auth.mfa_step_up",
        resourceType: "user",
        resourceId: context.user.id,
        organizationId: context.organization.id,
        userId: context.user.id,
        after: { usedRecoveryCode: challenge.usedRecoveryCode },
      });
      return NextResponse.json({ ok: true });
    }

    if (!(await verifyPassword(parsed.password, context.user.passwordHash))) {
      await recordAuthenticationFailure(context.user.id);
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }
    const authVersion = await disableMfa(context.user.id);
    await createSession(context.user.id, context.organization.id, { authVersion, mfaVerifiedAt: null });
    await writeAuditLog({
      action: "auth.mfa_disabled",
      resourceType: "user",
      resourceId: context.user.id,
      organizationId: context.organization.id,
      userId: context.user.id,
      after: { reauthenticated: true },
    });
    return NextResponse.json({ ok: true });
  } catch (actionError) {
    return jsonError(actionError);
  }
}
