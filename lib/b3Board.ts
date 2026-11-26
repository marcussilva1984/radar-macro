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
  pvp: number | null;
  monthlyDY: number;
  // Desconto em relação à máxima dos últimos 20 pregões (negativo = abaixo da máxima)
  desconto20d: number | null;
  // % acima/abaixo da MM20 (negativo = preço abaixo da média → possível suporte)
  mma20dist: number | null;
  // Últimos 31 fechamentos para o cliente calcular variação em N dias (1-30)
  closes30: number[];
  signal: "oportunidade" | "descontado" | "neutro" | "caro";
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
    const empty: FiiRow = {
      fii, price: null, pvp: null, monthlyDY: fii.monthlyDY,
      desconto20d: null, mma20dist: null, closes30: [], signal: "neutro",
    };
    if (!data || data.closes.length < 2) return empty;

    const { price, closes } = data;
    const pvp = price / fii.vpa;

    // Desconto da máxima dos últimos 20 pregões
    const window20 = closes.slice(-20);
    const high20 = Math.max(...window20);
    const desconto20d = high20 > 0 ? ((price - high20) / high20) * 100 : null;

    // Distância da MM20 (média simples dos últimos 20 fechamentos)
    const mma20 = window20.reduce((a, b) => a + b, 0) / window20.length;
    const mma20dist = mma20 > 0 ? ((price - mma20) / mma20) * 100 : null;

    // Últimos 31 closes para o cliente calcular variação em 1-30 dias
    const closes30 = closes.slice(-31);

    // Sinal combinado: P/VP + desconto
    let signal: FiiRow["signal"] = "neutro";
    if (pvp > 1.10) {
      signal = "caro";
    } else if (pvp < 0.95 && desconto20d !== null && desconto20d < -5) {
      signal = "oportunidade"; // barato pelo P/VP E já caiu bastante da máxima recente
    } else if (pvp < 1.0 && desconto20d !== null && desconto20d < -3) {
      signal = "descontado";
    }

    return { fii, price, pvp, monthlyDY: fii.monthlyDY, desconto20d, mma20dist, closes30, signal };
  });
}
