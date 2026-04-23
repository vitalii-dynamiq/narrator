import { AskInterface } from "@/components/ask/ask-interface";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  return <AskInterface initialQuestion={params.q ?? ""} />;
}
