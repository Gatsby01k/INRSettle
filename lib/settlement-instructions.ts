import "server-only";

import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { UserFacingError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { decryptSettlementData, encryptSettlementData } from "@/lib/sensitive-data";

export const settlementInstructionSchema = z.object({
  beneficiaryName: z.string().trim().min(2).max(160),
  bankName: z.string().trim().min(2).max(160),
  bankCode: z.string().trim().min(5).max(32),
  accountNumber: z.string().trim().min(5).max(64),
  accountType: z.enum(["savings", "current"]),
  mobile: z.string().trim().regex(/^\+?[0-9]{8,15}$/),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  purpose: z.string().trim().min(3).max(240),
});

export type SettlementExecutionInstruction = z.infer<typeof settlementInstructionSchema>;

export async function saveSettlementInstruction(input: {
  settlementId: string;
  organizationId: string;
  userId: string;
  instruction: unknown;
}) {
  const instruction = settlementInstructionSchema.parse(input.instruction);
  const settlement = await prisma.settlement.findFirst({
    where: { id: input.settlementId, organizationId: input.organizationId },
    select: { id: true, publicId: true, status: true },
  });
  if (!settlement) throw new UserFacingError("Settlement was not found.");
  if (!["REQUESTED", "APPROVED"].includes(settlement.status)) {
    throw new UserFacingError(
      "Execution instructions can only be changed before provider execution begins.",
    );
  }

  const payloadCiphertext = encryptSettlementData(instruction);
  return prisma.$transaction(async (tx) => {
    const saved = await tx.settlementExecutionInstruction.upsert({
      where: { settlementId: settlement.id },
      create: {
        organizationId: input.organizationId,
        settlementId: settlement.id,
        createdById: input.userId,
        payloadCiphertext,
      },
      update: {
        createdById: input.userId,
        payloadCiphertext,
        payloadVersion: { increment: 1 },
      },
    });
    if (settlement.status === "APPROVED") {
      await tx.settlement.update({
        where: { id: settlement.id },
        data: { status: "REQUESTED", approvedAt: null },
      });
      await tx.settlementEvent.create({
        data: {
          settlementId: settlement.id,
          fromStatus: "APPROVED",
          toStatus: "REQUESTED",
          actorId: input.userId,
          note: "Approval invalidated because the encrypted execution instruction changed.",
        },
      });
    }
    await writeAuditLog({
      action: "settlement.execution_instruction.saved",
      resourceType: "settlement",
      resourceId: settlement.id,
      organizationId: input.organizationId,
      userId: input.userId,
      after: {
        publicId: settlement.publicId,
        payloadVersion: saved.payloadVersion,
        approvalInvalidated: settlement.status === "APPROVED",
        fieldsPresent: Object.keys(instruction).filter(
          (key) => Boolean(instruction[key as keyof SettlementExecutionInstruction]),
        ),
      },
    }, tx);
    return saved;
  });
}

export async function getSettlementInstruction(
  settlementId: string,
  organizationId: string,
): Promise<SettlementExecutionInstruction> {
  const stored = await prisma.settlementExecutionInstruction.findFirst({
    where: { settlementId, organizationId },
    select: { payloadCiphertext: true },
  });
  if (!stored) {
    throw new UserFacingError(
      "Complete the encrypted execution instruction before sending this settlement to a provider.",
    );
  }
  return settlementInstructionSchema.parse(
    decryptSettlementData<unknown>(stored.payloadCiphertext),
  );
}
