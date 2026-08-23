import "server-only";
import { db } from "@/lib/db/client";
import { macroEvents, youtubeVideos } from "@/lib/db/schema";
import { gte } from "drizzle-orm";

export interface MentionTrend {
  tag: string;
  thisWeek: number;
  lastWeek: number;
  changePct: number | null; // null quando lastWeek=0 (não dá pra calcular % de zero)
}

// Temas contados nas menções — mistura ativos específicos (o que "está sendo procurado")
// com os temas macro/geopolíticos já rastreados. \b evita falso positivo em substring.
const MENTION_TOPICS: Array<{ label: string; pattern: RegExp }> = [
  { label: "bitcoin", pattern: /\bbitcoin\b/i },
  { label: "ethereum", pattern: /\bethereum\b/i },
  { label: "ouro", pattern: /\bgold\b|\bouro\b/i },
  { label: "petróleo", pattern: /\boil\b|\bpetróleo\b/i },
  { label: "commodities", pattern: /\bcommodit/i },
  { label: "guerra", pattern: /\bwar\b|\bguerra\b/i },
  { label: "tarifas", pattern: /\btariff\b|\btarifa/i },
  { label: "sanções", pattern: /\bsanction\b|\bsanç/i },
  { label: "opep", pattern: /\bopec\b|\bopep\b/i },
  { label: "fed/juros", pattern: /\bfed\b|\bpowell\b|\bfomc\b|\binterest rate\b|\bjuros\b/i },
  { label: "recessão", pattern: /\brecession\b|\brecessão\b/i },
  { label: "inflação", pattern: /\binflation\b|\binflaç/i },
  { label: "china", pattern: /\bchina\b/i },
  { label: "irã", pattern: /\biran\b|\birã\b/i },
  { label: "ucrânia/rússia", pattern: /\bukraine\b|\brussia\b|\bucrânia\b|\brússia\b/i },
];

// Cruza duas fontes: os eventos RSS (poucos, mas curados) e os títulos dos vídeos do YouTube
// (centenas por dia, amostra bem maior) — sozinha a RSS dá 1-2 menções, quase não diz nada.
export async function getMentionsTrend(): Promise<MentionTrend[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [events, videos] = await Promise.all([
    db.select({ title: macroEvents.title, publishedAt: macroEvents.publishedAt }).from(macroEvents).where(gte(macroEvents.publishedAt, since)),
    db.select({ title: youtubeVideos.title, publishedAt: youtubeVideos.publishedAt }).from(youtubeVideos).where(gte(youtubeVideos.publishedAt, since)),
  ]);

  const titles = [...events, ...videos];
  const thisWeekCounts = new Map<string, number>();
  const lastWeekCounts = new Map<string, number>();

  for (const row of titles) {
    const bucket = row.publishedAt >= weekAgo ? thisWeekCounts : lastWeekCounts;
    for (const { label, pattern } of MENTION_TOPICS) {
      if (pattern.test(row.title)) {
        bucket.set(label, (bucket.get(label) ?? 0) + 1);
      }
    }
  }

  return MENTION_TOPICS.map(({ label }) => {
    const thisWeek = thisWeekCounts.get(label) ?? 0;
    const lastWeek = lastWeekCounts.get(label) ?? 0;
    const changePct = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : null;
    return { tag: label, thisWeek, lastWeek, changePct };
  })
    .filter((t) => t.thisWeek > 0 || t.lastWeek > 0)
    .sort((a, b) => b.thisWeek - a.thisWeek);
}

// Frase de interpretação — os números sozinhos ("#war 1") não dizem nada pra quem não olha
// todo dia; isso traduz em português o que o padrão significa.
export function getMentionsHeadline(mentions: MentionTrend[]): string {
  if (mentions.length === 0) {
    return "Nenhum tema relevante identificado nos eventos e vídeos dessa semana.";
  }

  const totalThisWeek = mentions.reduce((acc, m) => acc + m.thisWeek, 0);
  const top = mentions[0];

  if (totalThisWeek < 5) {
    return `Poucas menções rastreadas essa semana (${totalThisWeek} no total) — narrativa fragmentada, sem tema claramente dominante ainda.`;
  }

  if (top.changePct !== null && top.changePct > 30) {
    return `"${top.tag}" domina a semana: ${top.thisWeek} menções, alta de ${top.changePct.toFixed(0)}% vs. semana passada — narrativa ganhando força rápido.`;
  }
  if (top.lastWeek === 0 && top.thisWeek >= 2) {
    return `"${top.tag}" surgiu essa semana (${top.thisWeek} menções, nada na semana passada) — tema novo entrando no radar.`;
  }
  return `"${top.tag}" segue como tema mais citado (${top.thisWeek} menções), sem mudança brusca de intensidade vs. semana passada.`;
}
