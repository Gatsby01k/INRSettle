import { z } from "zod";

/**
 * Validation schemas for the PontisGlobe integration. These mirror the request
 * and callback shapes documented at https://docs.pontisglobe.com.
 */

/** Final callback statuses Pontis emits (in-progress states never call back). */
export const PONTIS_CALLBACK_STATUSES = [
  "completed",
  "failed",
  "reversed",
  "rejected",
  "canceled",
] as const;

/** `source_amount` is a decimal string with two fractional digits. */
const amountSchema = z
  .string()
  .regex(/^\d+\.\d{2}$/, "source_amount must be a decimal string with two trailing digits, e.g. \"10.00\".");

export const recipientDetailsSchema = z
  .object({
    name: z.string().min(1).max(140),
    account_number: z.string().min(1).max(64),
    ifsc: z.string().min(1).max(20).optional(),
  })
  .passthrough();

export const payoutRequestSchema = z.object({
  idempotency_key: z.string().min(1),
  country_code: z.string().min(2).max(3),
  currency_code: z.string().min(3).max(3),
  payment_method: z.string().min(1),
  source_amount: amountSchema,
  source_currency: z.string().min(1).max(10),
  recipient_details: recipientDetailsSchema,
});

export const payoutStatusRequestSchema = z.object({
  transaction_id: z.string().min(1),
});

export const webhookPayloadSchema = z.object({
  transaction_id: z.string().min(1),
  status: z.enum(PONTIS_CALLBACK_STATUSES),
  status_message: z.string().nullable().optional(),
});

export type PayoutRequestInput = z.infer<typeof payoutRequestSchema>;
export type PayoutStatusRequestInput = z.infer<typeof payoutStatusRequestSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
