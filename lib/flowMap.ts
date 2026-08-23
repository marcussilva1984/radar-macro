import "server-only";
import { db } from "@/lib/db/client";
import { flowSeries } from "@/lib/db/schema";
import { gte } from "drizzle-orm";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";
import { computeCurrencyStrength } from "@/lib/forex";
import { FX_PAIRS, type FxPair } from "@/lib/sources/forexSymbols";

export interface FlowNode {
  label: string;
  weeklyChangePct: number;
  group: "ativo" | "moeda";
}

// Visão unificada de "pra onde o dinheiro migrou" na semana — mistura classes que a aba
// Forex e a Home tratam separadamente (moedas) com os ativos de fluxo (ouro, BTC, S&P,
// treasuries, DXY), tudo na mesma escala de comparação.
export async function getFlowMap(): Promise<FlowNode[]> {
  const since = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(flowSeries).where(gte(flowSeries.date, since)).orderBy(flowSeries.date);

  const bySymbol = new Map<string, number[]>();
  for (const r of rows) {
    if (r.changePct === null) continue;
    const list = bySymbol.get(r.symbol) ?? [];
    list.push(r.changePct);
    bySymbol.set(r.symbol, list);
  }

  const weeklyOf = (symbol: string) => {
    const series = bySymbol.get(symbol);
    if (!series || series.length === 0) return null;
    return series.slice(-5).reduce((a, b) => a + b, 0);
  };

  const nodes: FlowNode[] = [];

  for (const { symbol, label } of FLOW_SYMBOLS) {
    const w = weeklyOf(symbol);
    if (w !== null) nodes.push({ label, weeklyChangePct: w, group: "ativo" });
  }

  const fxWeekly = new Map<FxPair, number>();
  for (const { pair } of FX_PAIRS) {
    const w = weeklyOf(pair);
    if (w !== null) fxWeekly.set(pair, w);
  }
  const currencyStrength = computeCurrencyStrength(fxWeekly);
  for (const { currency, score } of currencyStrength) {
    nodes.push({ label: currency, weeklyChangePct: score, group: "moeda" });
  }

  return nodes.sort((a, b) => b.weeklyChangePct - a.weeklyChangePct);
}
