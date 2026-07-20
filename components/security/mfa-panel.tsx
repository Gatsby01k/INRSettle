"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/helper-text";

type Enrollment = { secret: string; otpauthUri: string };

async function mfaRequest(body: Record<string, string>) {
  const response = await fetch("/api/security/mfa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "MFA request failed.");
  return data as Record<string, unknown>;
}

export function MfaPanel({
  enabled,
  stepUpFresh,
  enrolledAt,
}: {
  enabled: boolean;
  stepUpFresh: boolean;
  enrolledAt: string | null;
}) {
  const router = useRouter();
  const [enrollment, setEnrollment] = React.useState<Enrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "MFA request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (recoveryCodes) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Save these one-time recovery codes now. INRSettle stores only keyed hashes and cannot show them again.
        </div>
        <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-sm leading-7 text-emerald-300">
          {recoveryCodes.join("\n")}
        </pre>
        <Button onClick={() => { setRecoveryCodes(null); router.refresh(); }}>I saved the codes</Button>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          MFA is not enrolled. Approval policies fail closed until a TOTP authenticator is confirmed.
        </p>
        {!enrollment ? (
          <Button
            disabled={busy}
            onClick={() => run(async () => {
              const data = await mfaRequest({ action: "enroll_start" });
              setEnrollment({ secret: String(data.secret), otpauthUri: String(data.otpauthUri) });
            })}
          >
            Start authenticator enrollment
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Add this account manually in your authenticator app</p>
              <p className="mt-2 break-all font-mono text-xs">Secret: {enrollment.secret}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium">Show otpauth URI</summary>
                <p className="mt-2 break-all font-mono text-[11px]">{enrollment.otpauthUri}</p>
              </details>
            </div>
            <Field label="Current six-digit code" htmlFor="mfa-enroll-code">
              <Input
                id="mfa-enroll-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
              />
            </Field>
            <Button
              disabled={busy || code.trim().length < 6}
              onClick={() => run(async () => {
                const data = await mfaRequest({ action: "enroll_confirm", code });
                setRecoveryCodes(data.recoveryCodes as string[]);
                setEnrollment(null);
                setCode("");
              })}
            >
              Confirm and enable MFA
            </Button>
          </div>
        )}
        {error ? <p role="alert" className="text-sm font-medium text-rose-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Authenticator MFA enabled{enrolledAt ? ` since ${new Date(enrolledAt).toLocaleString()}` : ""}. Current session step-up: {stepUpFresh ? "fresh" : "expired or absent"}.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">Refresh approval assurance</h3>
          <Field label="Authenticator or recovery code" htmlFor="mfa-step-code">
            <Input
              id="mfa-step-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              placeholder="123456"
            />
          </Field>
          <Button
            disabled={busy || code.trim().length < 6}
            onClick={() => run(async () => {
              await mfaRequest({ action: "step_up", code });
              setCode("");
              router.refresh();
            })}
          >
            Verify for approvals
          </Button>
        </div>
        <div className="space-y-3 rounded-lg border border-rose-200 p-4">
          <h3 className="font-semibold text-slate-900">Disable MFA</h3>
          <p className="text-xs text-slate-600">Requires both the account password and a current MFA/recovery code. Existing sessions are revoked.</p>
          <Field label="Password" htmlFor="mfa-disable-password">
            <Input id="mfa-disable-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Button
            variant="destructive"
            disabled={busy || !password || code.trim().length < 6}
            onClick={() => run(async () => {
              await mfaRequest({ action: "disable", code, password });
              setCode("");
              setPassword("");
              router.refresh();
            })}
          >
            Disable MFA
          </Button>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}
