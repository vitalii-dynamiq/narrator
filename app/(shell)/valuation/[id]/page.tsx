import { ValuationBridgeView } from "@/components/valuation/valuation-bridge-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ValuationBridgeView entityId={id} />;
}
