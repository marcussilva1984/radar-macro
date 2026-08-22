import "server-only";
import { db } from "@/lib/db/client";
import { macroEvents, flowSeries } from "@/lib/db/schema";
import { desc, gte } from "drizzle-orm";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";
import { zScore } from "@/lib/stats";

export interface TimelineEntry {
  id: number;
  category: string;
  country: string;
  title: string;
  sourceUrl: string | null;
  tags: string[];
  publishedAt: Date;
  duplicateCount: number; // quantas outras fontes noticiaram o mesmo evento (agrupadas)
  moves: Array<{ symbol: string; label: string; changePct: number | null; surprise: number | null }>;
}

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

// Agrupa eventos quase-duplicados (mesmo assunto noticiado por fontes diferentes) dentro
// de uma janela de 48h e mesmo país — evita a timeline repetir a mesma notícia várias vezes.
function dedupeEvents<T extends { title: string; country: string; publishedAt: Date }>(
  events: T[]
): Array<T & { duplicateCount: number }> {
  const out: Array<T & { duplicateCount: number }> = [];
  for (const ev of events) {
    const words = titleWords(ev.title);
    const match = out.find(
      (o) =>
        o.country === ev.country &&
        Math.abs(o.publishedAt.getTime() - ev.publishedAt.getTime()) < 48 * 60 * 60 * 1000 &&
        jaccard(titleWords(o.title), words) > 0.6
    );
    if (match) {
      match.duplicateCount++;
    } else {
      out.push({ ...ev, duplicateCount: 0 });
    }
  }
  return out;
}

// Junta cada evento recente com a variação dos ativos de fluxo no dia seguinte, com um
// score de "surpresa" (z-score do movimento vs. os ~30 dias anteriores daquele ativo).
export async function getRecentTimeline(days = 14): Promise<TimelineEntry[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const historySince = new Date(Date.now() - (days + 35) * 24 * 60 * 60 * 1000);

  const rawEvents = await db
    .select()
    .from(macroEvents)
    .where(gte(macroEvents.publishedAt, since))
    .orderBy(desc(macroEvents.publishedAt))
    .limit(150);

  const allFlows = await db
    .select()
    .from(flowSeries)
    .where(gte(flowSeries.date, historySince))
    .orderBy(flowSeries.date);

  const events = dedupeEvents(rawEvents);

  return events.map((ev) => {
    const dayAfter = new Date(ev.publishedAt);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

    const moves = FLOW_SYMBOLS.map(({ symbol, label }) => {
      const series = allFlows.filter((f) => f.symbol === symbol);
      const idx = series.findIndex((f) => f.date.toDateString() === dayAfter.toDateString());
      if (idx === -1) return { symbol, label, changePct: null, surprise: null };

      const point = series[idx];
      const history = series
        .slice(Math.max(0, idx - 30), idx)
        .map((f) => f.changePct)
        .filter((v): v is number => v !== null);

      return {
        symbol,
        label,
        changePct: point.changePct,
        surprise: point.changePct !== null ? zScore(point.changePct, history) : null,
      };
    }).filter((m) => m.changePct !== null);

    return {
      id: ev.id,
      category: ev.category,
      country: ev.country,
      title: ev.title,
      sourceUrl: ev.sourceUrl,
      tags: ev.tags,
      publishedAt: ev.publishedAt,
      duplicateCount: ev.duplicateCount,
      moves,
    };
  });
}
