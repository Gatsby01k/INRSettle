import { AuditActorType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  action: string;
  resourceType: string;
  resourceId?: string;
  organizationId?: string;
  userId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  requestId?: string;
  actorType?: AuditActorType;
};

type AuditDb = Pick<Prisma.TransactionClient, "auditLog">;

const SENSITIVE_AUDIT_KEY =
  /(?:password|secret|token|authorization|cookie|sourceAccount|targetAccount|account_number|acc_id|email|mobile|recipient_details|rawResponse|providerResponse|rawPayload|payload)$/i;

/**
 * Audit logs should explain a decision, not become a second PII/secret store.
 * Callers still choose the business summary, while this final boundary removes
 * common credential, account and raw-payload fields recursively.
 */
export function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditValue);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SENSITIVE_AUDIT_KEY.test(key) ? "[REDACTED]" : redactAuditValue(nested),
    ]),
  );
}

/**
 * Writes an audit row using either the root client or the caller's transaction.
 * Critical state changes pass their transaction here so business state and its
 * audit evidence commit or roll back together.
 */
export async function writeAuditLog(input: AuditInput, db: AuditDb = prisma) {
  return db.auditLog.create({
    data: {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      organizationId: input.organizationId,
      userId: input.userId,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(redactAuditValue(input.before))),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(redactAuditValue(input.after))),
      ipAddress: input.ipAddress,
      requestId: input.requestId,
      actorType: input.actorType ?? AuditActorType.USER,
    },
  });
}
