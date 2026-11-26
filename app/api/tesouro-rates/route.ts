import { NextResponse } from "next/server";
import { fetchPrefixedByYear } from "@/lib/sources/anbima";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await fetchPrefixedByYear());
  } catch (err) {
    return NextResponse.json({ years: [], error: (err as Error).message }, { status: 500 });
  }
}
