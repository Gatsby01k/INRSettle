import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  authenticateUser,
  createSession,
  getSession,
  recordAuthenticationFailure,
  recordAuthenticationSuccess,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthHero } from "@/components/auth/auth-hero";
import { LoginForm, type LoginState } from "@/components/auth/login-form";
import { verifyUserMfaChallenge } from "@/lib/mfa";

export const metadata: Metadata = {
  title: "Sign in — INRSettle Console",
  description: "Access treasury, settlement, and reconciliation workflows for your organization.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://inrsettle.com/login" },
  icons: { icon: "/assets/favicon.png", apple: "/assets/favicon.png" },
};

async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  "use server";

  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const mfaCode = String(formData.get("mfaCode") ?? "").trim();
  const authenticated = await authenticateUser(email, password);

  if (!authenticated) {
    return { error: "Invalid email or password. Please try again." };
  }

  const { user, membership } = authenticated;
  let authVersion = user.authVersion;
  let mfaVerifiedAt: number | null = null;
  let usedRecoveryCode = false;
  if (user.mfaEnabled) {
    if (!mfaCode) {
      return { error: null, mfaRequired: true };
    }
    try {
      const challenge = await verifyUserMfaChallenge(user.id, mfaCode);
      if (!challenge.verified) {
        await recordAuthenticationFailure(user.id);
        return { error: "Invalid authenticator or recovery code.", mfaRequired: true };
      }
      authVersion = challenge.authVersion;
      usedRecoveryCode = challenge.usedRecoveryCode;
      mfaVerifiedAt = Math.floor(Date.now() / 1000);
    } catch {
      return { error: "MFA verification is unavailable. Contact an administrator.", mfaRequired: true };
    }
  }
  await recordAuthenticationSuccess(user.id);
  await createSession(user.id, membership.organizationId, { authVersion, mfaVerifiedAt });
  await writeAuditLog({
    action: "auth.login",
    resourceType: "user",
    resourceId: user.id,
    organizationId: membership.organizationId,
    userId: user.id,
    after: { mfaVerified: user.mfaEnabled, usedRecoveryCode },
  });
  redirect("/dashboard");
}

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <AuthLayout hero={<AuthHero />}>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to inrsettle.com
      </Link>

      <div className="mt-8 lg:hidden">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/mark.png"
            alt="INRSettle"
            width={40}
            height={40}
            className="rounded-lg border border-slate-200 bg-white p-1.5"
          />
          <div>
            <p className="text-lg font-semibold tracking-tight text-slate-900">INRSettle</p>
            <p className="text-xs text-slate-500">Authorized workspace</p>
          </div>
        </div>
      </div>

      <div className="auth-form-card mt-8 rounded-lg border border-slate-200 bg-white p-6 sm:p-7">
        <header>
          <p className="text-xs font-medium text-slate-500">Console access</p>
          <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight tracking-tight text-slate-950">
            Sign in to INRSettle
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-slate-500">
            Open your organization&apos;s settlement operations workspace.
          </p>
        </header>

        <div className="mt-6">
          <LoginForm action={login} />
        </div>

        <p className="mt-4 text-center text-[12px] text-slate-400">
          Access and privileged actions are audit-recorded.
        </p>
      </div>

      <p className="mt-6 text-[13px] text-slate-500">
        Need access for your team?{" "}
        <Link
          href="/contact?intent=access"
          className="font-semibold text-brand-emerald-ink transition-colors hover:text-brand-emerald"
        >
          Request access
        </Link>
      </p>

      <p className="mt-8 border-t border-slate-200 pt-5 text-[12px] leading-relaxed text-slate-400">
        Restricted to authorized organization members.
      </p>
    </AuthLayout>
  );
}
