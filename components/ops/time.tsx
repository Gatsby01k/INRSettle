// Phase 0 — canonical timestamp rendering.
//
// Product decision: INRSettle is an INR-corridor product, so all timestamps
// display in IST (Asia/Kolkata) with an explicit zone label. The full UTC
// ISO string is always available on hover for reconciliation against
// provider/bank records. Use this instead of formatDateTime in UI.

const IST_FORMAT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const IST_DATE_ONLY = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatIst(value: Date | string | number, opts: { dateOnly?: boolean } = {}): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return opts.dateOnly ? IST_DATE_ONLY.format(date) : `${IST_FORMAT.format(date)} IST`;
}

export function Time({
  value,
  dateOnly = false,
  className,
}: {
  value: Date | string | number | null | undefined;
  dateOnly?: boolean;
  className?: string;
}) {
  if (value == null) return <span className={className}>—</span>;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return <span className={className}>—</span>;

  return (
    <time
      dateTime={date.toISOString()}
      title={`${date.toISOString()} (UTC)`}
      className={className}
      suppressHydrationWarning
    >
      {formatIst(date, { dateOnly })}
    </time>
  );
}
