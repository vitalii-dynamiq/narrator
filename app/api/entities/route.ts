import { NextResponse } from "next/server";
import { buildEntityCatalog } from "@/lib/jedox/catalog";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ entities: buildEntityCatalog() });
}
