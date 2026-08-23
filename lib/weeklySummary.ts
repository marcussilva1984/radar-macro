import "server-only";
import { db } from "@/lib/db/client";
import { weeklySummaries } from "@/lib/db/schema";
import { getRecentTimeline } from "@/lib/timeline";
import { getUpcomingEvents } from "@/lib/sources/economicCalendar";
import { desc } from "drizzle-orm";

const CATEGORY_LABEL: Record<string, string> = {
  central_bank: "banco central",
  geopolitics: "geopolítica",
  macro_data: "dado macro",
};

// Gera um parágrafo em texto puxando os eventos de maior "surpresa" (z-score) da semana.
// Fase 1: heurística simples, sem LLM — só ranqueia pelo dado que já está no banco.
export async function generateWeeklySummary(): Promise<string> {
  const entries = await getRecentTimeline(7);

  const scored = entries
    .map((e) => {
      const maxSurprise = Math.max(0, ...e.moves.map((m) => Math.abs(m.surprise ?? 0)));
      const topMove = e.moves.reduce<(typeof e.moves)[number] | null>((best, m) => {
        if (m.surprise === null) return best;
        if (!best || Math.abs(m.surprise) > Math.abs(best.surprise ?? 0)) return m;
        return best;
      }, null);
      return { entry: e, maxSurprise, topMove };
    })
    .filter((s) => s.maxSurprise > 0)
    .sort((a, b) => b.maxSurprise - a.maxSurprise)
    .slice(0, 5);

  if (scored.length === 0) {
    return "Sem eventos com reação estatisticamente relevante nos ativos de fluxo nesta semana (ou histórico insuficiente para calcular surpresa — precisa de ~30 dias de dados acumulados).";
  }

  const lines = scored.map(({ entry, topMove }) => {
    const cat = CATEGORY_LABEL[entry.category] ?? entry.category;
    const moveText = topMove
      ? `${topMove.label} reagiu ${topMove.changePct! >= 0 ? "+" : ""}${topMove.changePct!.toFixed(2)}% (z=${topMove.surprise!.toFixed(1)})`
      : "sem reação mensurável";
    return `- [${entry.country}/${cat}] ${entry.title} → ${moveText}`;
  });

  return `Destaques da semana (maiores desvios vs. padrão histórico dos ativos de fluxo):\n\n${lines.join("\n")}`;
}

// Seção "o que esperar" — eventos macro já conhecidos com antecedência (calendário manual),
// não descoberta via RSS (que só pega o que já aconteceu).
export function generateUpcomingSection(): string {
  const upcoming = getUpcomingEvents(7);
  if (upcoming.length === 0) {
    return "Sem eventos macro relevantes conhecidos pra próxima semana (calendário manual — pode haver falas de banco central não agendadas com antecedência).";
  }
  const lines = upcoming.map((e) => `- ${e.date} [${e.country}] ${e.title}`);
  return `O que esperar na próxima semana:\n\n${lines.join("\n")}`;
}

export async function saveWeeklySummary(): Promise<string> {
  const recap = await generateWeeklySummary();
  const upcoming = generateUpcomingSection();
  const summary = `${recap}\n\n---\n\n${upcoming}`;
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay()); // domingo da semana atual

  await db
    .insert(weeklySummaries)
    .values({ weekStart, summary })
    .onConflictDoUpdate({ target: weeklySummaries.weekStart, set: { summary } });

  return summary;
}

export async function getLatestWeeklySummary() {
  const [row] = await db.select().from(weeklySummaries).orderBy(desc(weeklySummaries.weekStart)).limit(1);
  return row ?? null;
}

// Semana atual + anterior, pra comparar "o que rolou" com "o que a gente esperava".
export async function getLastTwoWeeklySummaries() {
  return db.select().from(weeklySummaries).orderBy(desc(weeklySummaries.weekStart)).limit(2);
}
