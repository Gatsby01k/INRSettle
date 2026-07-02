"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Phase 7 (M3) — route-group error boundary for the console.
 * Calm, specific, with a way forward. No stack traces to the user.
 */
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="ops-panel mx-auto mt-10 max-w-md p-6 text-center">
      <p className="text-[15px] font-semibold tracking-tight text-slate-950">Something went wrong loading this view</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        Your data is unaffected — this is a display error, not a settlement error. Retry, or contact support if it
        persists.
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button type="button" variant="primary" size="sm" onClick={() => reset()}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href="/dashboard">Back to Home</a>
        </Button>
      </div>
    </div>
  );
}
