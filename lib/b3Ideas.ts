import "server-only";
import { db } from "@/lib/db/client";
import { b3Ideas } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { fetchDailyCloses } from "@/lib/sources/yahoo";
import { fetchLiquidUniverse, fetchFiiDividendYields, type B3Asset } from "@/lib/sources/b3";
import { mapWithConcurrency } from "@/lib/concurrency";
import { zScore } from "@/lib/stats";
import type { Conviction } from "@/lib/forex";

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function convictionOf(absScore: number, aligned: boolean): Conviction {
  if (absScore >= 0.6 && aligned) return "forte";
  if (absScore >= 0.35) return "médio";
  return "fraco";
}

interface Metrics {
  dailyPct: number;
  weeklyPct: number;
  z: number | null;
  discountPct: number; // quanto o preço está abaixo da máxima dos últimos ~20 pregões
}

function computeMetrics(closes: number[]): Metrics | null {
  if (closes.length < 12) return null;
  const changes = closes.slice(1).map((c, i) => ((c - closes[i]) / closes[i]) * 100);
  const dailyPct = changes[changes.length - 1];
  const weeklyPct = changes.slice(-5).reduce((a, b) => a + b, 0);
  const z = zScore(dailyPct, changes.slice(-21, -1));
  const high = Math.max(...closes.slice(-20));
  const last = closes[closes.length - 1];
  return { dailyPct, weeklyPct, z, discountPct: ((high - last) / high) * 100 };
}

interface IdeaRow {
  symbol: string;
  kind: "acao" | "fii";
  signal: "alta" | "queda";
  conviction: Conviction;
  score: number;
  title: string;
  detail: string;
}

function buildIdea(
  asset: B3Asset,
  m: Metrics,
  ibovWeekly: number,
  dy: number | undefined
): IdeaRow {
  const rel = m.weeklyPct - ibovWeekly;
  const aligned = Math.sign(m.dailyPct) === Math.sign(m.weeklyPct);
  const zTxt = m.z !== null ? `z=${m.z.toFixed(1)}` : "z n/d";
  let score: number;
  let detail: string;

  if (asset.kind === "acao") {
    // momentum (semana) + fluxo (força relativa vs Ibovespa) + surpresa do dia (z-score)
    score = 0.4 * clamp(m.weeklyPct / 5) + 0.3 * clamp(rel / 5) + 0.3 * clamp((m.z ?? 0) / 3);
    detail = `Semana ${m.weeklyPct >= 0 ? "+" : ""}${m.weeklyPct.toFixed(1)}% (vs Ibovespa ${rel >= 0 ? "+" : ""}${rel.toFixed(1)}pp), dia ${m.dailyPct >= 0 ? "+" : ""}${m.dailyPct.toFixed(1)}% (${zTxt}), ${m.discountPct.toFixed(1)}% abaixo da máxima de 20 pregões.`;
  } else if (dy !== undefined) {
    // valuation do FII: yield alto + cota descontada vs máxima + tendência
    score = 0.4 * clamp((dy - 10) / 5) + 0.3 * clamp(m.discountPct / 8) + 0.3 * clamp(m.weeklyPct / 3);
    detail = `Dividend yield 12m ${dy.toFixed(1)}%, cota ${m.discountPct.toFixed(1)}% abaixo da máxima de 20 pregões, semana ${m.weeklyPct >= 0 ? "+" : ""}${m.weeklyPct.toFixed(1)}%, dia ${m.dailyPct >= 0 ? "+" : ""}${m.dailyPct.toFixed(1)}%.`;
  } else {
    score = 0.5 * clamp(m.weeklyPct / 3) + 0.5 * clamp((m.z ?? 0) / 3);
    detail = `Sem dividend yield disponível — só momentum: semana ${m.weeklyPct >= 0 ? "+" : ""}${m.weeklyPct.toFixed(1)}%, dia ${m.dailyPct >= 0 ? "+" : ""}${m.dailyPct.toFixed(1)}% (${zTxt}).`;
  }

  const signal = score >= 0 ? "alta" : "queda";
  // Sem yield conhecido o FII nunca passa de "médio" (falta o pilar de valuation).
  let conviction = convictionOf(Math.abs(score), aligned);
  if (asset.kind === "fii" && dy === undefined && conviction === "forte") conviction = "médio";

  return {
    symbol: asset.symbol,
    kind: asset.kind,
    signal,
    conviction,
    score,
    title: `${asset.symbol}: viés de ${signal} (${asset.kind === "acao" ? "ação" : "FII"})`,
    detail,
  };
}

// Roda no cron diário: busca o universo líquido, histórico curto de cada papel, pontua e
// regrava a tabela (só forte/médio — fraco é ruído). Falha de um papel não derruba a rodada.
export async function refreshB3Ideas(): Promise<{ analyzed: number; saved: number; notes: string[] }> {
  const notes: string[] = [];
  const universe = await fetchLiquidUniverse();

  let dyMap = new Map<string, number>();
  try {
    dyMap = await fetchFiiDividendYields();
  } catch (err) {
    notes.push(`sem dividend yield: ${(err as Error).message}`);
  }

  let ibovWeekly = 0;
  try {
    const ibov = await fetchDailyCloses("^BVSP", 15);
    const c = ibov.map((p) => p.close);
    const ch = c.slice(1).map((v, i) => ((v - c[i]) / c[i]) * 100);
    ibovWeekly = ch.slice(-5).reduce((a, b) => a + b, 0);
  } catch (err) {
    notes.push(`sem Ibovespa: ${(err as Error).message}`);
  }

  const rows = await mapWithConcurrency(universe, 8, async (asset) => {
    try {
      const closes = (await fetchDailyCloses(`${asset.symbol}.SA`, 45)).map((p) => p.close);
      const metrics = computeMetrics(closes);
      return metrics ? buildIdea(asset, metrics, ibovWeekly, dyMap.get(asset.symbol)) : null;
    } catch {
      return null;
    }
  });

  const ideas = rows.filter((r): r is IdeaRow => r !== null);
  const keep = ideas.filter((i) => i.conviction !== "fraco");

  await db.delete(b3Ideas);
  if (keep.length > 0) await db.insert(b3Ideas).values(keep);

  return { analyzed: ideas.length, saved: keep.length, notes };
}

export async function getB3Ideas() {
  return db.select().from(b3Ideas).orderBy(desc(b3Ideas.score));
}
