import "server-only";
import { db } from "@/lib/db/client";
import { flowSeries } from "@/lib/db/schema";
import { gte } from "drizzle-orm";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";
import { FRED_INDICES } from "@/lib/sources/fredIndices";
import { computeCurrencyStrength } from "@/lib/forex";
import { FX_PAIRS, type FxPair } from "@/lib/sources/forexSymbols";

export interface FlowNode {
  label: string;
  weeklyChangePct: number;
  group: "ativo" | "moeda";
  latestClose: number | null; // valor/cotação atual — null pra moedas (não tem "preço", só força relativa)
}

// Visão unificada de "pra onde o dinheiro migrou" na semana — mistura classes que a aba
// Forex e a Home tratam separadamente (moedas) com os ativos de fluxo (ouro, BTC, S&P,
// treasuries, DXY), tudo na mesma escala de comparação.
export async function getFlowMap(): Promise<FlowNode[]> {
  const since = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(flowSeries).where(gte(flowSeries.date, since)).orderBy(flowSeries.date);

  const bySymbol = new Map<string, Array<{ changePct: number | null; close: number }>>();
  for (const r of rows) {
    const list = bySymbol.get(r.symbol) ?? [];
    list.push({ changePct: r.changePct, close: r.close });
    bySymbol.set(r.symbol, list);
  }

  const weeklyOf = (symbol: string) => {
    const series = bySymbol.get(symbol)?.filter((s) => s.changePct !== null);
    if (!series || series.length === 0) return null;
    return series.slice(-5).reduce((a, b) => a + (b.changePct ?? 0), 0);
  };
  const latestCloseOf = (symbol: string) => {
    const series = bySymbol.get(symbol);
    return series && series.length > 0 ? series[series.length - 1].close : null;
  };

  const nodes: FlowNode[] = [];

  for (const { symbol, label } of FLOW_SYMBOLS) {
    const w = weeklyOf(symbol);
    if (w !== null) nodes.push({ label, weeklyChangePct: w, group: "ativo", latestClose: latestCloseOf(symbol) });
  }

  // Dólar Amplo (FRED) — cesta bem mais ampla que o DXY (que é ~72% EUR+JPY).
  for (const { symbol, label } of FRED_INDICES) {
    const w = weeklyOf(symbol);
    if (w !== null) nodes.push({ label, weeklyChangePct: w, group: "ativo", latestClose: latestCloseOf(symbol) });
  }

  const fxWeekly = new Map<FxPair, number>();
  for (const { pair } of FX_PAIRS) {
    const w = weeklyOf(pair);
    if (w !== null) fxWeekly.set(pair, w);
  }
  const currencyStrength = computeCurrencyStrength(fxWeekly);
  for (const { currency, score } of currencyStrength) {
    nodes.push({ label: currency, weeklyChangePct: score, group: "moeda", latestClose: null });
  }

  // Índice caseiro (não oficial) de dólar vs. moedas de commodity — não existe um gratuito
  // pronto, então construímos com AUD+NZD (moedas de commodity que já rastreamos). Sinal
  // invertido: AUD/NZD subindo = USD caindo vs. commodities.
  const audWeekly = weeklyOf("AUDUSD");
  const nzdWeekly = weeklyOf("NZDUSD");
  if (audWeekly !== null && nzdWeekly !== null) {
    nodes.push({
      label: "USD vs Commodity FX (caseiro)",
      weeklyChangePct: -((audWeekly + nzdWeekly) / 2),
      group: "ativo",
      latestClose: null,
    });
  }

  return nodes.sort((a, b) => b.weeklyChangePct - a.weeklyChangePct);
}
