import { NextResponse } from "next/server";
import { getFiiBoard } from "@/lib/b3Board";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await getFiiBoard();
    const rows = board.map((r) => ({
      symbol: r.fii.symbol,
      name: r.fii.name,
      type: r.fii.type,
      vpa: r.fii.vpa,
      payDay: r.fii.payDay ?? null,
      price: r.price,
      pvp: r.pvp,
      monthlyDY: r.monthlyDY,
      desconto20d: r.desconto20d,
      mma20dist: r.mma20dist,
      closes30: r.closes30,
      signal: r.signal,
    }));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: (err as Error).message }, { status: 500 });
  }
}
