import { Skeleton } from "@/components/ui/skeleton";

export default function SettlementsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading settlement workspace">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="border-y border-slate-200 py-3">
        <Skeleton className="h-9 w-full max-w-4xl" />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[1.1fr_0.8fr_0.7fr_0.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="grid min-h-16 grid-cols-[1.1fr_0.8fr_0.7fr_0.7fr] items-center gap-4 border-b border-slate-100 px-4 last:border-0">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
