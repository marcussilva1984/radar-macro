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

export type Conviction = "forte" | "médio" | "fraco";

export interface TradeIdea {
  title: string;
  detail: string;
  pairs: FxPair[];
  conviction: Conviction;
}

function convictionOf(absScore: number): Conviction {
  if (absScore >= 0.35) return "forte";
  if (absScore >= SIGNAL_THRESHOLD) return "médio";
  return "fraco";
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

const MIN_IDEAS = 10;

function buildTradeIdeas(
  signals: FxPairSignal[],
  audNzdCorr: number | null
): TradeIdea[] {
  const ideas: TradeIdea[] = [];
  const byPair = new Map(signals.map((s) => [s.pair, s]));

  // 1. Tendência consistente (diário e semanal concordam) — o sinal mais "seguro" de continuação.
  const consistent = signals.filter((s) => s.trendConsistent && s.signal !== "estabilização");
  for (const s of consistent) {
    ideas.push({
      title: `${s.base}/${s.quote}: ${s.signal} consistente (diário e semanal)`,
      detail: `Variação diária ${s.changePct?.toFixed(2)}% e semanal ${s.weeklyChangePct?.toFixed(2)}% na mesma direção — não é só ruído de um dia.`,
      pairs: [s.pair],
      conviction: convictionOf(Math.abs(s.score)),
    });
  }

  // 2. Pares "linkados" pela correlação AUD/NZD: se um já mostra tendência clara ("esticado")
  // e o outro ainda não acompanhou (ou moveu bem menos), há espaço pra convergirem — mesma
  // lógica de "AUD/USD esticado, NZD/USD tem espaço pra seguir" pedida.
  if (audNzdCorr !== null && Math.abs(audNzdCorr) > 0.5) {
    for (const { a, b } of LINKED_CROSS_PAIRS) {
      const sigA = byPair.get(a);
      const sigB = byPair.get(b);
      if (!sigA || !sigB || sigA.signal === "estabilização") continue;
      const bLagging = sigB.signal !== sigA.signal || Math.abs(sigB.score) < Math.abs(sigA.score) * 0.5;
      if (!bLagging) continue;
      ideas.push({
        title: `${sigA.base}/${sigA.quote} esticado em ${sigA.signal}, ${sigB.base}/${sigB.quote} ainda não acompanhou`,
        detail: `AUD e NZD historicamente correlacionadas (r=${audNzdCorr.toFixed(2)} nos últimos 30 dias) — se ${sigA.base}/${sigA.quote} segue em ${sigA.signal}, há espaço pra ${sigB.base}/${sigB.quote} convergir na mesma direção, especialmente se o diferencial de juros não mudar.`,
        pairs: [a, b],
        conviction: convictionOf(Math.abs(sigA.score)),
      });
    }
  }

  // 3. Hedge cross-asset: pra cada ideia forte, sugere uma posição numa moeda "seca" (não
  // compartilha moeda com ela) — não fica 100% exposto ao mesmo tema (ex: só EUR fraco).
  const strongIdeas = ideas.filter((i) => i.conviction === "forte").slice(0, 3);
  for (const idea of strongIdeas) {
    const mainCurrencies = new Set(
      idea.pairs.flatMap((p) => {
        const s = byPair.get(p);
        return s ? [s.base, s.quote] : [];
      })
    );
    const hedgeCandidate = signals.find(
      (s) =>
        s.trendConsistent &&
        !mainCurrencies.has(s.base) &&
        !mainCurrencies.has(s.quote) &&
        !ideas.some((i) => i.pairs.includes(s.pair) && i.title.startsWith("Hedge"))
    );
    if (hedgeCandidate) {
      ideas.push({
        title: `Hedge sugerido: ${hedgeCandidate.base}/${hedgeCandidate.quote} (${hedgeCandidate.signal})`,
        detail: `Não compartilha moeda com "${idea.title}" — serve pra não concentrar a aposta numa moeda só.`,
        pairs: [hedgeCandidate.pair],
        conviction: convictionOf(Math.abs(hedgeCandidate.score)),
      });
    }
  }

  // 4. Se ainda não chegou no mínimo de ideias, completa com os pares de maior |score|
  // que ainda não apareceram (convicção mais fraca, mas ainda informativo).
  const usedPairs = new Set(ideas.flatMap((i) => i.pairs));
  for (const s of signals) {
    if (ideas.length >= MIN_IDEAS) break;
    if (usedPairs.has(s.pair) || s.signal === "estabilização") continue;
    ideas.push({
      title: `${s.base}/${s.quote}: viés de ${s.signal}`,
      detail: `Força relativa ${s.strengthDiff?.toFixed(2) ?? "—"} e carry ${s.carryDiff.toFixed(2)}pp apontam ${s.signal}, mas sem confirmação diário+semanal ainda — convicção menor.`,
      pairs: [s.pair],
      conviction: convictionOf(Math.abs(s.score)),
    });
    usedPairs.add(s.pair);
  }

  const order: Record<Conviction, number> = { forte: 0, médio: 1, fraco: 2 };
  return ideas.sort((a, b) => order[a.conviction] - order[b.conviction]);
}

export interface EntradaLeg {
  pair: FxPair;
  action: "compra" | "venda";
}

export interface Entrada {
  legs: [EntradaLeg, EntradaLeg];
  hedgedCurrency: FxCurrency;
  syntheticView: string; // ex: "NZD vs USD" — a aposta real depois de cancelar a moeda comum
  conviction: Conviction;
  score: number;
  trendConsistent: boolean; // viés diário e semanal concordam na moeda sintética
  rationale: string;
}

// Pra uma moeda C aparecer "comprada" numa perna: se C é base do par, comprar o par;
// se C é quote, vender o par (vender X/C = vender X, comprar C).
function actionForLong(pair: { base: string; quote: string }, currency: string): "compra" | "venda" {
  return pair.base === currency ? "compra" : "venda";
}
function otherCurrency(pair: { base: string; quote: string }, currency: string): string {
  return pair.base === currency ? pair.quote : pair.base;
}
function flip(a: "compra" | "venda"): "compra" | "venda" {
  return a === "compra" ? "venda" : "compra";
}

// Gera combinações de 2 pernas que compartilham uma moeda comum em direções opostas — isso
// cancela o risco dessa moeda e isola uma aposta "sintética" nas outras duas (o padrão pedido:
// comprar EUR/USD + vender EUR/NZD protege o EUR e vira, na prática, uma aposta em NZD vs USD).
function generateEntradas(
  signals: FxPairSignal[],
  strengthByCurrency: Map<string, number>,
  weeklyStrengthByCurrency: Map<string, number>
): Entrada[] {
  const byPair = new Map(signals.map((s) => [s.pair, s]));
  const seen = new Map<string, Entrada>(); // dedup por par sintético (ex: NZD-USD), fica a de maior convicção

  for (const currency of FX_CURRENCIES) {
    const legsWithCurrency = FX_PAIRS.filter((p) => p.base === currency || p.quote === currency);
    for (let i = 0; i < legsWithCurrency.length; i++) {
      for (let j = i + 1; j < legsWithCurrency.length; j++) {
        const p1 = legsWithCurrency[i];
        const p2 = legsWithCurrency[j];

        // Perna 1: fica COMPRADA em `currency`. Perna 2: fica VENDIDA em `currency`.
        const action1 = actionForLong(p1, currency);
        const other1 = otherCurrency(p1, currency); // fica vendido em other1
        const action2 = flip(actionForLong(p2, currency));
        const other2 = otherCurrency(p2, currency); // fica comprado em other2
        if (other1 === other2) continue;

        const strDiff = (strengthByCurrency.get(other2) ?? 0) - (strengthByCurrency.get(other1) ?? 0);
        const weeklyDiff =
          (weeklyStrengthByCurrency.get(other2) ?? 0) - (weeklyStrengthByCurrency.get(other1) ?? 0);
        const carryDiff = (POLICY_RATES[other2] ?? 0) - (POLICY_RATES[other1] ?? 0);
        const score = 0.6 * strDiff + 0.2 * carryDiff + 0.2 * weeklyDiff;

        // Se o sinal deu negativo, a aposta real é a oposta (vender other2 / comprar other1) —
        // inverte as duas pernas em vez de descartar a combinação.
        const finalScore = Math.abs(score);
        const invert = score < 0;
        const legs: [EntradaLeg, EntradaLeg] = invert
          ? [
              { pair: p1.pair, action: flip(action1) },
              { pair: p2.pair, action: flip(action2) },
            ]
          : [
              { pair: p1.pair, action: action1 },
              { pair: p2.pair, action: action2 },
            ];
        const [viewLong, viewShort] = invert ? [other1, other2] : [other2, other1];

        const trendConsistent =
          Math.abs(strDiff) > TREND_THRESHOLD &&
          Math.abs(weeklyDiff) > TREND_THRESHOLD &&
          Math.sign(strDiff) === Math.sign(weeklyDiff);

        const key = [viewLong, viewShort].sort().join("-");
        const existing = seen.get(key);
        if (existing && existing.score >= finalScore) continue;

        const s1 = byPair.get(legs[0].pair);
        const s2 = byPair.get(legs[1].pair);
        seen.set(key, {
          legs,
          hedgedCurrency: currency as FxCurrency,
          syntheticView: `${viewLong} vs ${viewShort}`,
          conviction: convictionOf(finalScore),
          score: finalScore,
          trendConsistent,
          rationale: `${legs[0].action} ${legs[0].pair} + ${legs[1].action} ${legs[1].pair}: cancela a exposição a ${currency} (força ${strDiff.toFixed(2)} diário / ${weeklyDiff.toFixed(2)} semanal a favor de ${viewLong} vs ${viewShort}; carry ${carryDiff >= 0 ? "+" : ""}${carryDiff.toFixed(2)}pp). Viés diário: ${s1?.changePct?.toFixed(2) ?? "—"}% / ${s2?.changePct?.toFixed(2) ?? "—"}%. Timeframe: ler entrada no 4h, direção pelo diário/semanal.`,
        });
      }
    }
  }

  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}

export async function getForexBoard(): Promise<{
  strength: CurrencyStrength[];
  signals: FxPairSignal[];
  ideas: TradeIdea[];
  entradas: Entrada[];
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
  const entradas = generateEntradas(signals, strengthByCurrency, weeklyStrengthByCurrency);

  return { strength, signals, ideas, entradas, audNzdCorr };
}
