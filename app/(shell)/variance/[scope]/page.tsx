import { VarianceDeepDive } from "@/components/variance/variance-deep-dive";

export default async function Page({ params }: { params: Promise<{ scope: string }> }) {
  const { scope } = await params;
  return <VarianceDeepDive scope={scope} />;
}
