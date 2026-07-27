import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FlashMessage({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  const isError = tone === "error";
  const Icon = isError ? XCircle : CheckCircle2;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border-l-4 px-3.5 py-3 text-[13px] font-medium",
        isError
          ? "border-y-rose-200 border-r-rose-200 border-l-rose-500 bg-rose-50 text-rose-800"
          : "border-y-emerald-200 border-r-emerald-200 border-l-emerald-600 bg-emerald-50 text-emerald-800",
      )}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}
