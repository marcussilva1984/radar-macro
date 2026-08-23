import "server-only";
import { db } from "@/lib/db/client";
import { flowSeries } from "@/lib/db/schema";
import { gte } from "drizzle-orm";
import {
  FX_PAIRS,
  FX_CURRENCIES,
  TRIANGULATIONS,
  LINKED_CROSS_PAIRS,
  type FxPair,
  type FxCurrency,
} from "@/lib/sources/forexSymbols";
import { POLICY_RATES } from "@/lib/sources/policyRates";
import { pearsonCorrelation } from "@/lib/stats";

export interface CurrencyStrength {
  currency: FxCurrency;
  score: number; // média das variações em que a moeda aparece, em pontos percentuais
}

export interface FxPairSignal {
  pair: FxPair;
  base: string;
  quote: string;
  changePct: number | null; // variação diária
  weeklyChangePct: number | null; // variação ~última semana
  strengthDiff: number | null; // força(base) - força(quote), diária
  weeklyStrengthDiff: number | null; // idem, semanal — usado pra ver se a tendência é consistente
  carryDiff: number; // juro(base) - juro(quote), viés estrutural de longo prazo
  asymmetry: number | null; // variação real do cross - variação implícita pelas duas pernas em USD
  signal: "alta" | "queda" | "estabilização";
  score: number;
  trendConsistent: boolean; // diário e semanal apontam na mesma direção
}

export interface TradeIdea {
  title: string;
  detail: string;
  pairs: FxPair[];
}

async function getSeriesBySymbol(days: number): Promise<Map<string, Array<{ date: Date; changePct: number }>>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(flowSeries).where(gte(flowSeries.date, since)).orderBy(flowSeries.date);

  const bySymbol = new Map<string, Array<{ date: Date; changePct: number }>>();
  for (const r of rows) {
    if (r.changePct === null) continue;
    if (!FX_PAIRS.some((p) => p.pair === r.symbol)) continue;
    const list = bySymbol.get(r.symbol) ?? [];
    list.push({ date: r.date, changePct: r.changePct });
    bySymbol.set(r.symbol, list);
  }
  return bySymbol;
}

function latestOf(series?: Array<{ changePct: number }>): number | undefined {
  return series && series.length > 0 ? series[series.length - 1].changePct : undefined;
}

// Variação semanal aproximada: soma das variações diárias dos últimos ~5 pregões.
function weeklyOf(series?: Array<{ changePct: number }>): number | undefined {
  if (!series || series.length === 0) return undefined;
  const lastWeek = series.slice(-5);
  return lastWeek.reduce((acc, s) => acc + s.changePct, 0);
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

const SIGNAL_THRESHOLD = 0.15;
const TREND_THRESHOLD = 0.1;

function buildTradeIdeas(
  signals: FxPairSignal[],
  audNzdCorr: number | null
): TradeIdea[] {
  const ideas: TradeIdea[] = [];
  const byPair = new Map(signals.map((s) => [s.pair, s]));

  // 1. Tendência consistente (diário e semanal concordam) — o sinal mais "seguro" de continuação.
  const consistent = signals.filter((s) => s.trendConsistent && s.signal !== "estabilização");
  for (const s of consistent.slice(0, 3)) {
    ideas.push({
      title: `${s.base}/${s.quote}: ${s.signal} consistente (diário e semanal)`,
      detail: `Variação diária ${s.changePct?.toFixed(2)}% e semanal ${s.weeklyChangePct?.toFixed(2)}% na mesma direção — não é só ruído de um dia.`,
      pairs: [s.pair],
    });
  }

  // 2. Pares "linkados" pela correlação AUD/NZD: se um já mostra tendência forte, o espelho
  // (mesma base, quote correlacionada) tende a seguir o mesmo caminho com um delay.
  if (audNzdCorr !== null && Math.abs(audNzdCorr) > 0.5) {
    for (const { a, b } of LINKED_CROSS_PAIRS) {
      const sigA = byPair.get(a);
      const sigB = byPair.get(b);
      if (!sigA || !sigB) continue;
      if (sigA.signal === "estabilização" || sigA.signal === sigB.signal) continue;
      // sigA já tendencia claro, sigB ainda não acompanhou — possível assimetria a se fechar.
      ideas.push({
        title: `${sigA.base}/${sigA.quote} já em ${sigA.signal}, ${sigB.base}/${sigB.quote} ainda não acompanhou`,
        detail: `AUD e NZD historicamente correlacionadas (r=${audNzdCorr.toFixed(2)} nos últimos 30 dias) — se ${sigA.base}/${sigA.quote} segue em ${sigA.signal}, há espaço pra ${sigB.base}/${sigB.quote} convergir na mesma direção, especialmente se o diferencial de juros não mudar.`,
        pairs: [a, b],
      });
    }
  }

  // 3. Hedge cross-asset: junto de uma ideia de queda numa moeda, sugere uma posição oposta
  // numa moeda "seca" (não correlacionada com a primeira ideia) pra não ficar 100% exposto
  // ao mesmo tema (ex: só EUR fraco). Pega o sinal mais forte que não compartilha moeda com a 1a ideia.
  if (ideas.length > 0) {
    const mainCurrencies = new Set(ideas[0].pairs.flatMap((p) => {
      const s = byPair.get(p);
      return s ? [s.base, s.quote] : [];
    }));
    const hedgeCandidate = signals.find(
      (s) => s.trendConsistent && !mainCurrencies.has(s.base) && !mainCurrencies.has(s.quote)
    );
    if (hedgeCandidate) {
      ideas.push({
        title: `Hedge sugerido: ${hedgeCandidate.base}/${hedgeCandidate.quote} (${hedgeCandidate.signal})`,
        detail: `Não compartilha moeda com a ideia principal — serve pra não concentrar a aposta numa moeda só.`,
        pairs: [hedgeCandidate.pair],
      });
    }
  }

  return ideas;
}

export async function getForexBoard(): Promise<{
  strength: CurrencyStrength[];
  signals: FxPairSignal[];
  ideas: TradeIdea[];
  audNzdCorr: number | null;
}> {
  const bySymbol = await getSeriesBySymbol(35);

  const dailyChanges = new Map<FxPair, number>();
  const weeklyChanges = new Map<FxPair, number>();
  for (const { pair } of FX_PAIRS) {
    const series = bySymbol.get(pair);
    const last = latestOf(series);
    const week = weeklyOf(series);
    if (last !== undefined) dailyChanges.set(pair, last);
    if (week !== undefined) weeklyChanges.set(pair, week);
  }

  const strength = computeCurrencyStrength(dailyChanges);
  const weeklyStrength = computeCurrencyStrength(weeklyChanges);
  const strengthByCurrency = new Map(strength.map((s) => [s.currency, s.score]));
  const weeklyStrengthByCurrency = new Map(weeklyStrength.map((s) => [s.currency, s.score]));

  const triByPair = new Map(TRIANGULATIONS.map((t) => [t.cross, t]));

  const audSeries = bySymbol.get("AUDUSD")?.map((s) => s.changePct) ?? [];
  const nzdSeries = bySymbol.get("NZDUSD")?.map((s) => s.changePct) ?? [];
  const audNzdCorr = pearsonCorrelation(audSeries, nzdSeries);

  const signals: FxPairSignal[] = FX_PAIRS.map(({ pair, base, quote }) => {
    const changePct = dailyChanges.get(pair) ?? null;
    const weeklyChangePct = weeklyChanges.get(pair) ?? null;

    const strengthDiff =
      strengthByCurrency.has(base as FxCurrency) && strengthByCurrency.has(quote as FxCurrency)
        ? (strengthByCurrency.get(base as FxCurrency) ?? 0) - (strengthByCurrency.get(quote as FxCurrency) ?? 0)
        : null;
    const weeklyStrengthDiff =
      weeklyStrengthByCurrency.has(base as FxCurrency) && weeklyStrengthByCurrency.has(quote as FxCurrency)
        ? (weeklyStrengthByCurrency.get(base as FxCurrency) ?? 0) -
          (weeklyStrengthByCurrency.get(quote as FxCurrency) ?? 0)
        : null;

    const carryDiff = (POLICY_RATES[base] ?? 0) - (POLICY_RATES[quote] ?? 0);

    let asymmetry: number | null = null;
    const tri = triByPair.get(pair);
    if (tri && changePct !== null) {
      const a = dailyChanges.get(tri.legA);
      const b = dailyChanges.get(tri.legB);
      if (a !== undefined && b !== undefined) {
        const implied = tri.op === "subtract" ? a - b : a + b;
        asymmetry = changePct - implied;
      }
    }

    const score =
      0.5 * (strengthDiff ?? 0) + 0.2 * carryDiff + 0.3 * (asymmetry !== null ? -asymmetry : 0);

    const signal: FxPairSignal["signal"] =
      score > SIGNAL_THRESHOLD ? "alta" : score < -SIGNAL_THRESHOLD ? "queda" : "estabilização";

    // Consistência calculada sobre a variação do PRÓPRIO par (o que é mostrado na tela),
    // não sobre a força agregada da moeda — senão o texto podia dizer "mesma direção" com
    // diário e semanal do par em sinais opostos (a força agregada pode divergir do par isolado).
    const trendConsistent =
      changePct !== null &&
      weeklyChangePct !== null &&
      Math.abs(changePct) > TREND_THRESHOLD &&
      Math.abs(weeklyChangePct) > TREND_THRESHOLD &&
      Math.sign(changePct) === Math.sign(weeklyChangePct);

    return {
      pair,
      base,
      quote,
      changePct,
      weeklyChangePct,
      strengthDiff,
      weeklyStrengthDiff,
      carryDiff,
      asymmetry,
      signal,
      score,
      trendConsistent,
    };
  }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const ideas = buildTradeIdeas(signals, audNzdCorr);

  return { strength, signals, ideas, audNzdCorr };
}
