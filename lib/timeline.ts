import "server-only";
import { db } from "@/lib/db/client";
import { macroEvents, flowSeries } from "@/lib/db/schema";
import { desc, gte } from "drizzle-orm";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";

export interface TimelineEntry {
  id: number;
  category: string;
  country: string;
  title: string;
  sourceUrl: string | null;
  tags: string[];
  publishedAt: Date;
  moves: Array<{ symbol: string; label: string; changePct: number | null }>;
}

// Junta cada evento recente com a variação dos ativos de fluxo no dia seguinte
// (proxy simples de "o que esse evento moveu"). Sem magia estatística na Fase 1.
export async function getRecentTimeline(days = 14): Promise<TimelineEntry[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(macroEvents)
    .where(gte(macroEvents.publishedAt, since))
    .orderBy(desc(macroEvents.publishedAt))
    .limit(100);

  const allFlows = await db
    .select()
    .from(flowSeries)
    .where(gte(flowSeries.date, since));

  return events.map((ev) => {
    const dayAfter = new Date(ev.publishedAt);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

    const moves = FLOW_SYMBOLS.map(({ symbol, label }) => {
      const point = allFlows.find(
        (f) =>
          f.symbol === symbol &&
          f.date.toDateString() === dayAfter.toDateString()
      );
      return { symbol, label, changePct: point?.changePct ?? null };
    }).filter((m) => m.changePct !== null);

    return {
      id: ev.id,
      category: ev.category,
      country: ev.country,
      title: ev.title,
      sourceUrl: ev.sourceUrl,
      tags: ev.tags,
      publishedAt: ev.publishedAt,
      moves,
    };
  });
}
