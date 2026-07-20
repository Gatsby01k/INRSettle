import { FundingStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiContext } from "@/lib/api";
import { updateSettlementFunding } from "@/lib/funding";
import { approvalMfaViolation, canManageFunding, roleErrorMessage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { fundingConfirmationViolation } from "@/lib/settlement-actions";
import { isMfaStepUpFresh } from "@/lib/auth";

const fundingUpdateSchema = z.object({
  status: z.nativeEnum(FundingStatus),
  requiredAmount: z.coerce.number().positive().optional(),
  fundedAmount: z.coerce.number().nonnegative().optional(),
  currency: z.string().trim().min(3).max(10).optional(),
  providerCode: z.string().trim().min(1).max(64).optional(),
  providerReference: z.string().trim().min(1).max(160).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { context, error } = await requireApiContext();
  if (error) return error;
  const { id } = await params;
  const settlement = await prisma.settlement.findFirst({
    where: { id, organizationId: context.organization.id },
    select: {
      id: true,
      publicId: true,
      fundingStatus: true,
      fundingRequired: true,
      fundedAmount: true,
      fundingCurrency: true,
      providerOperations: {
        where: { operationType: "FUNDING_REQUEST" },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!settlement) return NextResponse.json({ error: "Settlement was not found." }, { status: 404 });
  return NextResponse.json({ data: settlement });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { context, error } = await requireApiContext();
  if (error) return error;
  if (!canManageFunding(context.membership.role)) {
    return NextResponse.json({ error: roleErrorMessage(context.membership.role) }, { status: 403 });
  }

  try {
    const { id } = await params;
    const input = fundingUpdateSchema.parse(await request.json());
    if (input.status === FundingStatus.FUNDED) {
      const [target, settings] = await Promise.all([
        prisma.settlement.findFirst({
          where: { id, organizationId: context.organization.id },
          select: { createdById: true },
        }),
        prisma.organizationSettings.findUnique({
          where: { organizationId: context.organization.id },
        }),
      ]);
      const mfaViolation = approvalMfaViolation({
        requireMfaForApproval: settings?.requireMfaForApproval ?? true,
        mfaEnabled: context.user.mfaEnabled,
        mfaStepUpFresh: isMfaStepUpFresh(context.session),
      });
      if (mfaViolation) return NextResponse.json({ error: mfaViolation }, { status: 403 });
      const dualControlViolation = fundingConfirmationViolation({
        targetStatus: input.status,
        creatorId: target?.createdById,
        approverId: context.user.id,
      });
      if (dualControlViolation) {
        return NextResponse.json({ error: dualControlViolation }, { status: 403 });
      }
    }
    const settlement = await updateSettlementFunding({
      settlementId: id,
      organizationId: context.organization.id,
      userId: context.user.id,
      ...input,
    });
    return NextResponse.json({ data: settlement });
  } catch (err) {
    return jsonError(err);
  }
}
