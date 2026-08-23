import "server-only";

// Feed JSON não-oficial (hospedado pela FairEconomy, espelho do calendário do ForexFactory) —
// usado por muitos bots de trading, grátis e sem chave. Sem contrato/SLA oficial: se cair, a
// função lança e quem chama decide o fallback (ex: calendário manual em economicCalendar.ts).
const FF_WEEK_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

export interface FFEvent {
  title: string;
  country: string; // código de moeda: USD, EUR, JPY, GBP, AUD, NZD, CAD, CHF, CNY etc.
  date: Date;
  impact: "Low" | "Medium" | "High" | "Holiday";
  forecast: string;
  previous: string;
}

export async function fetchForexFactoryCalendar(): Promise<FFEvent[]> {
  const res = await fetch(FF_WEEK_URL, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ForexFactory feed: HTTP ${res.status}`);
  const raw = (await res.json()) as Array<{
    title: string;
    country: string;
    date: string;
    impact: string;
    forecast: string;
    previous: string;
  }>;

  return raw.map((e) => ({
    title: e.title,
    country: e.country,
    date: new Date(e.date),
    impact: (e.impact as FFEvent["impact"]) ?? "Low",
    forecast: e.forecast,
    previous: e.previous,
  }));
}

export interface FFEventWithCountdown extends FFEvent {
  daysUntil: number;
}

// Eventos dos EUA (USD) de impacto médio/alto, ainda não acontecidos, ordenados por data —
// cobre CPI, PPI, payroll, confiança do consumidor, PIB, falas de membros do Fed etc., tudo
// que o feed classifica como relevante (não é só uma lista fixa de tipos de evento). daysUntil
// já calculado aqui (não no componente) — Date.now() dentro de render é bloqueado pelo linter
// do React Compiler.
export async function getImportantUSEventsThisWeek(limit = 10): Promise<FFEventWithCountdown[]> {
  const all = await fetchForexFactoryCalendar();
  const now = new Date();
  return all
    .filter((e) => e.country === "USD" && (e.impact === "High" || e.impact === "Medium") && e.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit)
    .map((e) => ({
      ...e,
      daysUntil: Math.ceil((e.date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    }));
}
