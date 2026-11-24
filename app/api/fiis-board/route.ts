import { NextResponse } from "next/server";
import { getFiiBoard } from "@/lib/b3Board";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await getFiiBoard();
    // Serializa pro cliente (remove o objeto fii complexo, achata o que a UI precisa)
    const rows = board.map((r) => ({
      symbol: r.fii.symbol,
      name: r.fii.name,
      type: r.fii.type,
      vpa: r.fii.vpa,
      payDay: r.fii.payDay ?? null,
      price: r.price,
      changePct: r.changePct,
      pvp: r.pvp,
      monthlyDY: r.monthlyDY,
      rsiDaily: r.rsiDaily,
      rsiWeekly: r.rsiWeekly,
      signal: r.signal,
    }));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: (err as Error).message }, { status: 500 });
  }
}
