"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-700">
      <span>
        {label}
        {required ? <span className="ml-0.5 text-rose-600" aria-hidden="true">*</span> : null}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 placeholder:text-slate-400 hover:border-slate-400 focus:border-[var(--status-ok)] focus:outline-none focus:ring-3 focus:ring-[rgba(0,127,105,0.12)]"
      />
    </label>
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
      <Field name="email" label="Work email" type="email" placeholder="name@company.com" required autoComplete="email" />
      <Field name="company" label="Company" placeholder="Legal entity name" required autoComplete="organization" />
      <Field name="role" label="Role" placeholder="Your role" autoComplete="organization-title" />
      {mode === "access" ? (
        <>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            Monthly settlement volume
            <select
              name="monthly_volume"
              defaultValue=""
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700 hover:border-slate-400 focus:border-[var(--status-ok)] focus:outline-none focus:ring-3 focus:ring-[rgba(0,127,105,0.12)]"
            >
              <option value="">Select a range</option>
              <option>Below $10k</option>
              <option>$10k–$50k</option>
              <option>$50k–$250k</option>
              <option>$250k+</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            Operating workflow
            <textarea
              name="use_case"
              placeholder="Providers, controls and reconciliation requirements"
              className="min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-950 placeholder:text-slate-400 hover:border-slate-400 focus:border-[var(--status-ok)] focus:outline-none focus:ring-3 focus:ring-[rgba(0,127,105,0.12)]"
            />
          </label>
        </>
      ) : (
        <>
          <Field name="corridor" label="Corridor" placeholder="Settlement corridor" />
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            Integration context
            <textarea
              name="message"
              placeholder="Volumes, providers, controls and commercial requirements"
              className="min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-950 placeholder:text-slate-400 hover:border-slate-400 focus:border-[var(--status-ok)] focus:outline-none focus:ring-3 focus:ring-[rgba(0,127,105,0.12)]"
            />
          </label>
        </>
      )}
      <Button type="submit" variant="primary" size="lg" className="lp-cta-primary mt-1 w-full">
        Open email draft
      </Button>
      <p className="text-center text-xs leading-relaxed text-slate-400">
        Opens your email application addressed to info@inrsettle.com. These fields are not uploaded to INRSettle.
      </p>
    </form>
  );
}
