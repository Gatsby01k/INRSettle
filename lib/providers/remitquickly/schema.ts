import { z } from "zod";

export const beneficiaryDetailsSchema = z.object({
  acc_id: z.string().min(5).max(64),
  name: z.string().min(2).max(160),
  bank_name: z.string().min(2).max(160),
  ifsc: z.string().min(5).max(32),
  acc_type: z.enum(["savings", "current"]),
  mobile: z.string().regex(/^\+?[0-9]{8,15}$/),
  email: z.string().email().optional(),
});

export type BeneficiaryDetails = z.infer<typeof beneficiaryDetailsSchema>;
