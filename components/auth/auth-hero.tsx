import Image from "next/image";
import { Check } from "lucide-react";

const WORKSPACE_CONTEXT = [
  "Organization-scoped access",
  "Role-controlled actions",
  "Audit-recorded decisions",
  "MFA for sensitive approvals",
] as const;

export function AuthHero() {
  return (
    <section className="ops-rail relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-3 px-12 pt-10">
        <Image
          src="/assets/mark.png"
          alt=""
          width={40}
          height={40}
          className="rounded-lg border border-white/10 bg-white/5 p-1.5"
        />
        <div>
          <p className="text-base font-semibold tracking-tight">INRSettle</p>
          <p className="text-xs text-white/45">Settlement Operations Platform</p>
        </div>
      </div>

      <div className="max-w-lg px-12">
        <p className="text-xs font-medium text-emerald-300">Authorized workspace</p>
        <h1 className="mt-3 text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.035em]">
          Settlement decisions remain attributable.
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-7 text-white/60">
          Access provider operations, evidence, reconciliation, finality review and audit history for your
          organization.
        </p>
      </div>

      <div className="px-12 pb-10">
        <p className="mb-3 text-xs font-medium text-white/45">Workspace controls</p>
        <ul className="max-w-lg divide-y divide-white/10 border-y border-white/10">
          {WORKSPACE_CONTEXT.map((item) => (
            <li key={item} className="flex items-center gap-2.5 py-3 text-sm text-white/75">
              <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
