"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SCOPES = [
  ["quotes:read", "Read quotes"],
  ["quotes:write", "Create quotes"],
  ["settlements:read", "Read settlements"],
  ["settlements:write", "Create settlement requests"],
  ["funding:read", "Read funding state"],
  ["reconciliation:read", "Read reconciliation"],
  ["reconciliation:write", "Ingest reconciliation evidence"],
  ["finality:read", "Read finality assessments"],
  ["reports:read", "Export reports"],
] as const;

export function ApiCredentialForm() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "created" | "error">("idle");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  async function submit(formData: FormData) {
    setState("saving");
    setMessage("");
    setToken("");
    const response = await fetch("/api/api-credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        role: String(formData.get("role") ?? "FINANCE_VIEWER"),
        scopes: formData.getAll("scopes").map(String),
        expiresAt: formData.get("expiresAt") || undefined,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(body.error ?? "API credential could not be created.");
      return;
    }
    setToken(body.data.token);
    setState("created");
    setMessage("Copy this token now. INRSettle will not show it again.");
    router.refresh();
  }

  async function copyToken() {
    await navigator.clipboard.writeText(token);
    setMessage("Token copied. Store it in your secret manager.");
  }

  return (
    <form action={submit} className="ops-panel space-y-5 p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Create service credential</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            The secret is returned once. Only its prefix and one-way hash are retained.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="api-name">Credential name</Label>
          <Input id="api-name" name="name" required minLength={3} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="api-role">Service role</Label>
          <select id="api-role" name="role" defaultValue="FINANCE_VIEWER" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="FINANCE_VIEWER">Read-only integration</option>
            <option value="SETTLEMENT_OPERATOR">Settlement integration</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="api-expiry">Expiry</Label>
          <Input id="api-expiry" name="expiresAt" type="datetime-local" required />
        </div>
      </div>
      <fieldset>
        <legend className="text-xs font-semibold text-slate-700">Scopes</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SCOPES.map(([scope, label]) => (
            <label key={scope} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-700">
              <input type="checkbox" name="scopes" value={scope} className="h-4 w-4 accent-emerald-700" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {token ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-950">One-time service credential</p>
          <code className="mt-2 block break-all rounded-lg bg-white p-3 text-xs text-slate-800">{token}</code>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={copyToken}>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy token
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className={state === "error" ? "text-xs text-red-700" : state === "created" ? "text-xs text-amber-800" : "text-xs text-slate-500"} role="status">
          {message || "Fresh MFA assurance is required to issue a credential."}
        </p>
        <Button type="submit" size="sm" disabled={state === "saving"}>
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          {state === "saving" ? "Creating…" : "Create credential"}
        </Button>
      </div>
    </form>
  );
}

export function RevokeApiCredentialButton({ credentialId }: { credentialId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revoke() {
    setBusy(true);
    const response = await fetch("/api/api-credentials", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: credentialId }),
    });
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={revoke}>
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      {busy ? "Revoking…" : "Revoke"}
    </Button>
  );
}
