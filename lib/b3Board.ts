import "server-only";
import { db } from "@/lib/db/client";
import { flowSeries } from "@/lib/db/schema";
import { gte, inArray } from "drizzle-orm";
import { B3_STOCKS, type B3Stock } from "@/lib/sources/b3Stocks";
import { B3_FIIS, type B3Fii } from "@/lib/sources/b3Fiis";

// RSI(14) reutilizado do forex — fechamentos em ordem cronológica.
function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function toWeeklyCloses(closes: number[]): number[] {
  const weekly: number[] = [];
  for (let i = 4; i < closes.length; i += 5) weekly.push(closes[i]);
  return weekly;
}

// Mapa símbolo → preço atual + closes para RSI.
async function loadSeries(symbols: string[]): Promise<Map<string, { price: number; closes: number[] }>> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ symbol: flowSeries.symbol, close: flowSeries.close, date: flowSeries.date })
    .from(flowSeries)
    .where(gte(flowSeries.date, since));

  const map = new Map<string, { date: Date; close: number }[]>();
  for (const r of rows) {
    if (!symbols.includes(r.symbol)) continue;
    if (!map.has(r.symbol)) map.set(r.symbol, []);
    map.get(r.symbol)!.push({ date: r.date, close: r.close });
  }

  const result = new Map<string, { price: number; closes: number[] }>();
  for (const [sym, entries] of map) {
    const sorted = entries.sort((a, b) => a.date.getTime() - b.date.getTime());
    const closes = sorted.map((e) => e.close);
    result.set(sym, { price: closes[closes.length - 1], closes });
  }
  return result;
}

export interface StockRow {
  stock: B3Stock;
  price: number | null;
  changePct: number | null;    // variação 1 dia
  changePct5d: number | null;  // variação 5 dias
  rsiDaily: number | null;
  rsiWeekly: number | null;
  momentum: "alta" | "queda" | "neutro";
  dividendYield12m: number;    // DY estimado (da config)
}

export interface FiiRow {
  fii: B3Fii;
  price: number | null;
  changePct: number | null;
  pvp: number | null;          // preço / VPA
  monthlyDY: number;           // DY mensal da config
  rsiDaily: number | null;
  rsiWeekly: number | null;
  signal: "compra" | "neutro" | "caro";
}

export async function getStockBoard(): Promise<StockRow[]> {
  const symbols = B3_STOCKS.map((s) => s.symbol);
  const series = await loadSeries(symbols);

  return B3_STOCKS.map((stock): StockRow => {
    const data = series.get(stock.symbol);
    if (!data || data.closes.length < 2) {
      return { stock, price: null, changePct: null, changePct5d: null, rsiDaily: null, rsiWeekly: null, momentum: "neutro", dividendYield12m: stock.dividendYield12m };
    }
    const { price, closes } = data;
    const prev1 = closes[closes.length - 2];
    const prev5 = closes.length >= 6 ? closes[closes.length - 6] : closes[0];
    const changePct = ((price - prev1) / prev1) * 100;
    const changePct5d = ((price - prev5) / prev5) * 100;
    const rsiDaily = computeRSI(closes);
    const weekly = toWeeklyCloses(closes);
    const rsiWeekly = computeRSI(weekly);
    const momentum = changePct5d > 1.5 ? "alta" : changePct5d < -1.5 ? "queda" : "neutro";
    return { stock, price, changePct, changePct5d, rsiDaily, rsiWeekly, momentum, dividendYield12m: stock.dividendYield12m };
  });
}

export async function getFiiBoard(): Promise<FiiRow[]> {
  const symbols = B3_FIIS.map((f) => f.symbol);
  const series = await loadSeries(symbols);

  return B3_FIIS.map((fii): FiiRow => {
    const data = series.get(fii.symbol);
    if (!data || data.closes.length < 2) {
      return { fii, price: null, changePct: null, pvp: null, monthlyDY: fii.monthlyDY, rsiDaily: null, rsiWeekly: null, signal: "neutro" };
    }
    const { price, closes } = data;
    const prev1 = closes[closes.length - 2];
    const changePct = ((price - prev1) / prev1) * 100;
    const pvp = price / fii.vpa;
    const rsiDaily = computeRSI(closes);
    const weekly = toWeeklyCloses(closes);
    const rsiWeekly = computeRSI(weekly);
    // Sinal: P/VP < 0.95 e RSI não extremo = oportunidade; P/VP > 1.10 = caro
    const signal: FiiRow["signal"] = pvp < 0.95 && (rsiDaily === null || rsiDaily < 70) ? "compra" : pvp > 1.10 ? "caro" : "neutro";
    return { fii, price, changePct, pvp, monthlyDY: fii.monthlyDY, rsiDaily, rsiWeekly, signal };
  });
}
