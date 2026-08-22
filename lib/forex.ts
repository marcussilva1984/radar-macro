import "server-only";
import { db } from "@/lib/db/client";
import { flowSeries } from "@/lib/db/schema";
import { gte } from "drizzle-orm";
import { FX_PAIRS, FX_CURRENCIES, TRIANGULATIONS, type FxPair, type FxCurrency } from "@/lib/sources/forexSymbols";
import { POLICY_RATES } from "@/lib/sources/policyRates";

export interface CurrencyStrength {
  currency: FxCurrency;
  score: number; // média das variações diárias em que a moeda aparece, em pontos percentuais
}

export interface FxPairSignal {
  pair: FxPair;
  base: string;
  quote: string;
  changePct: number | null;
  strengthDiff: number | null; // força(base) - força(quote)
  carryDiff: number; // juro(base) - juro(quote), viés estrutural de longo prazo
  asymmetry: number | null; // variação real do cross - variação implícita pelas duas pernas em USD
  signal: "alta" | "queda" | "estabilização";
  score: number;
}

// Pega o changePct mais recente de cada par (último ponto salvo em flow_series).
async function getLatestChanges(): Promise<Map<FxPair, number>> {
  const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(flowSeries).where(gte(flowSeries.date, since)).orderBy(flowSeries.date);

  const latest = new Map<FxPair, number>();
  for (const r of rows) {
    if (r.changePct === null) continue;
    if (FX_PAIRS.some((p) => p.pair === r.symbol)) {
      latest.set(r.symbol as FxPair, r.changePct); // sobrescreve com o mais recente (ordenado por data)
    }
  }
  return latest;
}

export function computeCurrencyStrength(changes: Map<FxPair, number>): CurrencyStrength[] {
  const contributions = new Map<FxCurrency, number[]>();
  for (const c of FX_CURRENCIES) contributions.set(c, []);

  for (const { pair, base, quote } of FX_PAIRS) {
    const chg = changes.get(pair);
    if (chg === undefined) continue;
    contributions.get(base as FxCurrency)?.push(chg);
    contributions.get(quote as FxCurrency)?.push(-chg);
  }

  return FX_CURRENCIES.map((currency) => {
    const vals = contributions.get(currency) ?? [];
    const score = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { currency, score };
  }).sort((a, b) => b.score - a.score);
}

const SIGNAL_THRESHOLD = 0.15; // abaixo disso, chamamos de "estabilização" (score combinado fraco)

export async function getForexBoard(): Promise<{
  strength: CurrencyStrength[];
  signals: FxPairSignal[];
}> {
  const changes = await getLatestChanges();
  const strength = computeCurrencyStrength(changes);
  const strengthByCurrency = new Map(strength.map((s) => [s.currency, s.score]));

  const triByPair = new Map(TRIANGULATIONS.map((t) => [t.cross, t]));

  const signals: FxPairSignal[] = FX_PAIRS.map(({ pair, base, quote }) => {
    const changePct = changes.get(pair) ?? null;
    const strengthDiff =
      strengthByCurrency.has(base as FxCurrency) && strengthByCurrency.has(quote as FxCurrency)
        ? (strengthByCurrency.get(base as FxCurrency) ?? 0) - (strengthByCurrency.get(quote as FxCurrency) ?? 0)
        : null;
    const carryDiff = (POLICY_RATES[base] ?? 0) - (POLICY_RATES[quote] ?? 0);

    let asymmetry: number | null = null;
    const tri = triByPair.get(pair);
    if (tri && changePct !== null) {
      const a = changes.get(tri.legA);
      const b = changes.get(tri.legB);
      if (a !== undefined && b !== undefined) {
        const implied = tri.op === "subtract" ? a - b : a + b;
        asymmetry = changePct - implied;
      }
    }

    // Heurística simples: combina força relativa (peso maior, é o sinal de curto prazo mais
    // direto), carry (viés estrutural, peso menor pq é lento) e assimetria de triangulação
    // (se o cross está "atrasado" em relação ao que os pares USD implicam, tende a corrigir).
    const score =
      0.5 * (strengthDiff ?? 0) + 0.2 * carryDiff + 0.3 * (asymmetry !== null ? -asymmetry : 0);

    const signal: FxPairSignal["signal"] =
      score > SIGNAL_THRESHOLD ? "alta" : score < -SIGNAL_THRESHOLD ? "queda" : "estabilização";

    return { pair, base, quote, changePct, strengthDiff, carryDiff, asymmetry, signal, score };
  }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return { strength, signals };
}
