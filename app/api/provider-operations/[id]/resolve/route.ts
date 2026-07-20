import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isMfaStepUpFresh } from "@/lib/auth";
import { jsonError, requireApiContext } from "@/lib/api";
import { approvalMfaViolation, canApproveSettlement, roleErrorMessage } from "@/lib/permissions";
import {
  confirmProviderOperationNoEffect,
  syncReviewRequiredOperation,
} from "@/lib/providers/resolution";

const resolutionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SYNC_STATUS") }),
  z.object({
    action: z.literal("CONFIRM_NO_EFFECT"),
    confirmation: z.string().max(80),
    note: z.string().min(12).max(1000),
  }),
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { context, error } = await requireApiContext();
  if (error) return error;
  if (!canApproveSettlement(context.membership.role)) {
    return NextResponse.json({ error: roleErrorMessage(context.membership.role) }, { status: 403 });
  }

  try {
    const input = resolutionSchema.parse(await request.json());
    const { id } = await params;
    if (input.action === "SYNC_STATUS") {
      return NextResponse.json({
        data: await syncReviewRequiredOperation(id, context.user.id, context.organization.id),
      });
    }

    const mfaViolation = approvalMfaViolation({
      requireMfaForApproval: true,
      mfaEnabled: context.user.mfaEnabled,
      mfaStepUpFresh: isMfaStepUpFresh(context.session),
    });
    if (mfaViolation) {
      return NextResponse.json({ error: mfaViolation }, { status: 403 });
    }
    return NextResponse.json({
      data: await confirmProviderOperationNoEffect({
        operationId: id,
        userId: context.user.id,
        organizationId: context.organization.id,
        confirmation: input.confirmation,
        note: input.note,
      }),
    });
  } catch (resolutionError) {
    return jsonError(resolutionError);
  }
}
