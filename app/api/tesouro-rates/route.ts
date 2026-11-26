import { NextResponse } from "next/server";
import { fetchTesouroBonds } from "@/lib/sources/tesouroDireto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bonds = await fetchTesouroBonds();
    return NextResponse.json({ bonds, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ bonds: [], error: (err as Error).message }, { status: 500 });
  }
}
