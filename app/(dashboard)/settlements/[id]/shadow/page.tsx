import { redirect } from "next/navigation";

export default async function LegacySettlementControlsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/settlements/${encodeURIComponent(id)}/controls`);
}
