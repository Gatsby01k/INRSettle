"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type ProviderOption = {
  code: string;
  displayName: string;
};

type ExistingConnection = {
  providerCode: string;
  displayName: string;
  status: string;
  credentialsConfigured: boolean;
} | null;

const STATUS_OPTIONS = [
  { value: "CONFIGURING", label: "Configuration in progress" },
  { value: "INTEGRATION_VERIFIED", label: "Integration verified" },
  { value: "COMMERCIAL_READY", label: "Commercially ready" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DISABLED", label: "Disabled" },
] as const;

export function ProviderConnectionForm({
  providers,
  connection = null,
}: {
  providers: ProviderOption[];
  connection?: ExistingConnection;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setState("saving");
    setMessage("");
    const credentialsRef = String(formData.get("credentialsRef") ?? "").trim();
    const payload: Record<string, unknown> = {
      providerCode: String(formData.get("providerCode") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      status: String(formData.get("status") ?? "CONFIGURING"),
    };
    if (credentialsRef) payload.credentialsRef = credentialsRef;

    try {
      const response = await fetch("/api/provider-connections", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Connection could not be saved.");
      setState("saved");
      setMessage("Connection configuration saved and written to the audit trail.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Connection could not be saved.");
    }
  }

  const provider = connection
    ? providers.find((item) => item.code === connection.providerCode)
    : providers[0];

  return (
    <form action={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`providerCode-${connection?.providerCode ?? "new"}`}>Provider adapter</Label>
          <select
            id={`providerCode-${connection?.providerCode ?? "new"}`}
            name="providerCode"
            defaultValue={connection?.providerCode ?? provider?.code}
            disabled={Boolean(connection)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500"
          >
            {providers.map((item) => (
              <option key={item.code} value={item.code}>{item.displayName}</option>
            ))}
          </select>
          {connection ? <input type="hidden" name="providerCode" value={connection.providerCode} /> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`displayName-${connection?.providerCode ?? "new"}`}>Connection name</Label>
          <Input
            id={`displayName-${connection?.providerCode ?? "new"}`}
            name="displayName"
            defaultValue={connection?.displayName ?? provider?.displayName}
            required
            maxLength={120}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`status-${connection?.providerCode ?? "new"}`}>Operational state</Label>
          <select
            id={`status-${connection?.providerCode ?? "new"}`}
            name="status"
            defaultValue={connection?.status ?? "CONFIGURING"}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`credentialsRef-${connection?.providerCode ?? "new"}`}>
            Secret-manager reference
          </Label>
          <Input
            id={`credentialsRef-${connection?.providerCode ?? "new"}`}
            name="credentialsRef"
            autoComplete="off"
            aria-describedby={`credentialsHelp-${connection?.providerCode ?? "new"}`}
          />
          <p id={`credentialsHelp-${connection?.providerCode ?? "new"}`} className="text-xs leading-relaxed text-slate-500">
            {connection?.credentialsConfigured
              ? "A reference is configured. Leave blank to retain it."
              : "Use env://, vault://, aws-secrets://, gcp-secrets:// or azure-keyvault://."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p
          role="status"
          className={
            state === "error"
              ? "text-xs text-red-700"
              : state === "saved"
                ? "text-xs text-emerald-700"
                : "text-xs text-slate-500"
          }
        >
          {message || "Credential values are never stored in the application database."}
        </p>
        <Button type="submit" size="sm" disabled={state === "saving"}>
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          {state === "saving" ? "Saving…" : "Save connection"}
        </Button>
      </div>
    </form>
  );
}
