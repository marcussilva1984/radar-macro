import "server-only";
import { db } from "@/lib/db/client";
import { macroEvents } from "@/lib/db/schema";
import { gte } from "drizzle-orm";

export interface MentionTrend {
  tag: string;
  thisWeek: number;
  lastWeek: number;
  changePct: number | null; // null quando lastWeek=0 (não dá pra calcular % de zero)
}

// Quantas vezes cada tag (guerra, tarifa, opep, etc) apareceu nos eventos dessa semana vs.
// semana passada — termômetro numérico de qual narrativa está ganhando força, complementando
// a leitura qualitativa da timeline.
export async function getMentionsTrend(): Promise<MentionTrend[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ tags: macroEvents.tags, publishedAt: macroEvents.publishedAt })
    .from(macroEvents)
    .where(gte(macroEvents.publishedAt, since));

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekCounts = new Map<string, number>();
  const lastWeekCounts = new Map<string, number>();

  for (const row of rows) {
    const bucket = row.publishedAt >= weekAgo ? thisWeekCounts : lastWeekCounts;
    for (const tag of row.tags) {
      bucket.set(tag, (bucket.get(tag) ?? 0) + 1);
    }
  }

  const allTags = new Set([...thisWeekCounts.keys(), ...lastWeekCounts.keys()]);
  return [...allTags]
    .map((tag) => {
      const thisWeek = thisWeekCounts.get(tag) ?? 0;
      const lastWeek = lastWeekCounts.get(tag) ?? 0;
      const changePct = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : null;
      return { tag, thisWeek, lastWeek, changePct };
    })
    .filter((t) => t.thisWeek > 0 || t.lastWeek > 0)
    .sort((a, b) => b.thisWeek - a.thisWeek);
}
