"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Phase 5.2 — client affordance for the report's print/PDF pipeline. */
export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
}
