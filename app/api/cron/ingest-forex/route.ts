import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { flowSeries } from "@/lib/db/schema";
import { FX_PAIRS } from "@/lib/sources/forexSymbols";
import { fetchDailyCloses } from "@/lib/sources/yahoo";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: Record<string, number | string> = {};

  for (const { pair, yahoo } of FX_PAIRS) {
    try {
      const closes = await fetchDailyCloses(yahoo, 10);
      let inserted = 0;
      for (let i = 0; i < closes.length; i++) {
        const prev = closes[i - 1];
        const changePct = prev ? ((closes[i].close - prev.close) / prev.close) * 100 : null;
        await db
          .insert(flowSeries)
          .values({
            symbol: pair,
            date: closes[i].date,
            close: closes[i].close,
            changePct,
          })
          .onConflictDoUpdate({
            target: [flowSeries.symbol, flowSeries.date],
            set: { close: closes[i].close, changePct },
          });
        inserted++;
      }
      results[pair] = inserted;
    } catch (err) {
      results[pair] = `erro: ${(err as Error).message}`;
    }
  }

  return NextResponse.json({ ok: true, results });
}
