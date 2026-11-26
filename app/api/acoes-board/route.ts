import { NextResponse } from "next/server";
import { getStockBoard } from "@/lib/b3Board";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await getStockBoard();
    const rows = board.map((r) => ({
      symbol: r.stock.symbol,
      name: r.stock.name,
      sector: r.stock.sector,
      dividendYield12m: r.dividendYield12m,
      price: r.price,
      desconto20d: r.desconto20d,
      mma20dist: r.mma20dist,
      closes30: r.closes30,
      momentum: r.momentum,
    }));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: (err as Error).message }, { status: 500 });
  }
}
