import "server-only";
import { db } from "@/lib/db/client";
import { youtubeVideos } from "@/lib/db/schema";
import { desc, gte } from "drizzle-orm";
import type { Conviction } from "@/lib/forex";

// Mesmos 3 níveis de convicção/cor do Forex — aqui usados pra classificar importância do
// vídeo pelo assunto do título, não por um score numérico (não temos "força" de vídeo).
const FORTE_KEYWORDS = /\bfed\b|\bpowell\b|\bfomc\b|\bwar\b|\bguerra\b|\biran\b|\birã\b|\bukraine\b|\brussia\b|\bchina\b|\bsanction\b|\btariff\b|\brate cut\b|\binterest rate\b/i;
const MEDIO_KEYWORDS = /\bbitcoin\b|\bcrypto\b|\bcripto\b|\bgold\b|\bouro\b|\boil\b|\bopec\b|\binflation\b|\brecession\b|\bdebasement\b/i;

function classify(title: string): Conviction {
  if (FORTE_KEYWORDS.test(title)) return "forte";
  if (MEDIO_KEYWORDS.test(title)) return "médio";
  return "fraco";
}

const ORDER: Record<Conviction, number> = { forte: 0, médio: 1, fraco: 2 };

export async function getRecentVideos(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(youtubeVideos)
    .where(gte(youtubeVideos.publishedAt, since))
    .orderBy(desc(youtubeVideos.publishedAt))
    .limit(150);

  const withConviction = rows.map((r) => ({ ...r, conviction: classify(r.title) }));
  const byImportance = (a: (typeof withConviction)[number], b: (typeof withConviction)[number]) =>
    ORDER[a.conviction] - ORDER[b.conviction] || b.publishedAt.getTime() - a.publishedAt.getTime();

  return {
    followed: withConviction.filter((r) => r.subscribed).sort(byImportance),
    discovered: withConviction.filter((r) => !r.subscribed).sort(byImportance),
  };
}
