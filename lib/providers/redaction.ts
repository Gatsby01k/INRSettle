const SENSITIVE_PROVIDER_FIELD =
  /(?:account|acc_id|recipient|beneficiary|mobile|phone|email|address|name|password|secret|token|authorization|document|pan|aadhaar)/i;

/**
 * Produces a bounded operational summary for persistence. Provider payloads can
 * contain beneficiary PII or credential echoes; those values never belong in
 * the settlement record, proof row, webhook inbox, logs, or audit trail.
 */
export function redactProviderPayload(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactProviderPayload(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      result[key] = SENSITIVE_PROVIDER_FIELD.test(key)
        ? "[REDACTED]"
        : redactProviderPayload(item, depth + 1);
    }
    return result;
  }
  if (typeof value === "string") return value.slice(0, 2000);
  return value;
}
