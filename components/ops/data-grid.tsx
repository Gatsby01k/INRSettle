import { cn } from "@/lib/utils";

export function DataGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("ops-panel overflow-hidden", className)}>
      <div className="ops-scroll max-h-[70vh] overflow-auto">{children}</div>
    </div>
  );
}

export function DataGridHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
      <tr className="text-left text-[11px] font-semibold tracking-[0.02em] text-slate-500">{children}</tr>
    </thead>
  );
}

export function DataGridTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th scope="col" className={cn("whitespace-nowrap px-3.5 py-2.5 font-semibold first:pl-4 last:pr-4", className)}>{children}</th>;
}

export function DataGridBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function DataGridRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr tabIndex={0} className={cn("text-[13px] text-slate-700 outline-none transition-colors hover:bg-slate-50 focus:bg-[#f1faf7] focus-visible:shadow-[inset_3px_0_0_#087f69]", className)}>
      {children}
    </tr>
  );
}

export function DataGridTd({
  children,
  className,
  title,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} title={title} className={cn("px-3.5 py-3 align-middle first:pl-4 last:pr-4", className)}>
      {children}
    </td>
  );
}
