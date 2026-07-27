import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[70svh] place-items-center px-5 py-16">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-slate-500">Page not found</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          This workspace address is not available.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The page may have moved, or your role may not have access to it. Return to the product overview and continue
          from the current operational queue.
        </p>
        <Button asChild variant="primary" className="mt-6">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Return to overview
          </Link>
        </Button>
      </div>
    </main>
  );
}
