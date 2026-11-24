import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { flowSeries } from "@/lib/db/schema";
import { fetchDailyCloses } from "@/lib/sources/yahoo";
import { B3_STOCKS } from "@/lib/sources/b3Stocks";
import { B3_FIIS } from "@/lib/sources/b3Fiis";

export const maxDuration = 120;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const assets = [
    ...B3_STOCKS.map((s) => ({ symbol: s.symbol, yahoo: s.yahoo })),
    ...B3_FIIS.map((f) => ({ symbol: f.symbol, yahoo: f.yahoo })),
  ];

  const results: Record<string, number | string> = {};

  for (const { symbol, yahoo } of assets) {
    try {
      const closes = await fetchDailyCloses(yahoo, 10);
      for (let i = 0; i < closes.length; i++) {
        const prev = closes[i - 1];
        const changePct = prev ? ((closes[i].close - prev.close) / prev.close) * 100 : null;
        await db
          .insert(flowSeries)
          .values({ symbol, date: closes[i].date, close: closes[i].close, changePct })
          .onConflictDoUpdate({
            target: [flowSeries.symbol, flowSeries.date],
            set: { close: closes[i].close, changePct },
          });
      }
      results[symbol] = closes.length;
    } catch (err) {
      results[symbol] = `erro: ${(err as Error).message}`;
    }
  }

  return NextResponse.json({ ok: true, results });
}
