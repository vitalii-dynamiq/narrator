import { HierarchyDashboard } from "@/components/dashboard/hierarchy-dashboard";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HierarchyDashboard id={id} level="group" />;
}
