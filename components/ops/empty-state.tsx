import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
  icon?: LucideIcon;
}) {
  return (
    <div className="ops-panel flex min-h-44 flex-col items-start justify-center px-6 py-8 text-left sm:flex-row sm:items-center sm:justify-start sm:gap-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-3 min-w-0 sm:mt-0">
        <p className="text-sm font-semibold tracking-tight text-slate-950">{title}</p>
        <p className="mt-1 max-w-lg text-[13px] leading-5 text-slate-500">{description}</p>
      </div>
      {action ? (
        <Button asChild className="mt-4 sm:ml-auto sm:mt-0" variant="outline" size="sm">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
