"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";

function Field({ name, type = "text", placeholder, required }: {
  name: string;
  type?: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
      aria-label={placeholder}
      className="w-full rounded-lg border border-[var(--ops-line)] bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--status-ok)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,199,157,0.15)]"
    />
  );
}

export function ContactMailForm({ mode }: { mode: "access" | "sales" }) {
  function openDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      Array.from(data.entries()).map(([key, value]) => [key, String(value).trim()]),
    );
    const subject = mode === "access"
      ? `INRSettle access request — ${values.company || "company"}`
      : `INRSettle partnership discussion — ${values.company || "company"}`;
    const labels = mode === "access"
      ? ["email", "company", "role", "monthly_volume", "use_case"]
      : ["email", "company", "role", "corridor", "message"];
    const body = labels
      .map((key) => `${key.replaceAll("_", " ")}: ${values[key] || "—"}`)
      .join("\n");
    window.location.href = `mailto:info@inrsettle.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form onSubmit={openDraft} className="grid gap-3">
      <Field name="email" type="email" placeholder="Work email" required />
      <Field name="company" placeholder="Company" required />
      <Field name="role" placeholder="Role" />
      {mode === "access" ? (
        <>
          <select
            name="monthly_volume"
            defaultValue=""
            aria-label="Monthly INR/USDT settlement volume"
            className="w-full rounded-lg border border-[var(--ops-line)] bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-[var(--status-ok)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,199,157,0.15)]"
          >
            <option value="">Monthly INR/USDT settlement volume</option>
            <option>Below $10k</option>
            <option>$10k–$50k</option>
            <option>$50k–$250k</option>
            <option>$250k+</option>
          </select>
          <textarea
            name="use_case"
            placeholder="Your settlement workflow, providers and control requirements"
            aria-label="Use case"
            className="min-h-28 w-full resize-y rounded-lg border border-[var(--ops-line)] bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--status-ok)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,199,157,0.15)]"
          />
        </>
      ) : (
        <>
          <Field name="corridor" placeholder="Corridor interest" />
          <textarea
            name="message"
            placeholder="Volumes, integration scope, partnership requirements"
            aria-label="Message"
            className="min-h-28 w-full resize-y rounded-lg border border-[var(--ops-line)] bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--status-ok)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,199,157,0.15)]"
          />
        </>
      )}
      <Button type="submit" variant="primary" className="lp-cta-primary mt-1 w-full">
        Open email draft
      </Button>
      <p className="text-center text-xs leading-relaxed text-slate-400">
        Opens your email application addressed to info@inrsettle.com. These fields are not uploaded to INRSettle.
      </p>
    </form>
  );
}
