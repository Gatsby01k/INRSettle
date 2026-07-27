"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  description,
  eyebrow,
  footer,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  eyebrow?: string;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ops-animate-overlay fixed inset-0 z-50 bg-[rgba(7,17,31,0.46)] backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "ops-animate-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-[var(--ops-line)] bg-white shadow-[var(--ops-shadow-lg)] outline-none",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--ops-line-soft)] px-5 py-4">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 text-xs font-medium text-slate-500">
                {eyebrow}
              </p>
            ) : null}
            <DialogPrimitive.Title className="truncate text-[15px] font-semibold tracking-tight text-slate-950">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 truncate text-[13px] text-slate-500">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title} details</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="ops-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--ops-line-soft)] px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
