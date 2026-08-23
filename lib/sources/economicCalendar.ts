// Calendário de eventos macro recorrentes conhecidos com antecedência (reuniões de bancos
// centrais, payroll/CPI/PPI/ADP dos EUA). Datas aproximadas — atualize conforme o calendário
// oficial (federalreserve.gov, bls.gov, bcb.gov.br) muda. Diferente da timeline principal (que
// é só o que já aconteceu, via RSS), isso é usado pra saber o que vem *antes* de acontecer, sem
// precisar de uma API paga de calendário econômico.
export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  title: string;
  country: string;
}

export const KNOWN_EVENTS: CalendarEvent[] = [
  { date: "2026-09-02", title: "ADP Emprego (privado) — agosto", country: "US" },
  { date: "2026-09-04", title: "Payroll (NFP) + Desemprego — agosto", country: "US" },
  { date: "2026-09-10", title: "CPI dos EUA — agosto", country: "US" },
  { date: "2026-09-11", title: "PPI dos EUA — agosto", country: "US" },
  { date: "2026-09-16", title: "Decisão de juros do Fed (FOMC)", country: "US" },
  { date: "2026-09-23", title: "Copom — decisão Selic", country: "BR" },
  { date: "2026-09-30", title: "ADP Emprego (privado) — setembro", country: "US" },
  { date: "2026-10-02", title: "Payroll (NFP) + Desemprego — setembro", country: "US" },
  { date: "2026-10-13", title: "CPI dos EUA — setembro", country: "US" },
  { date: "2026-10-14", title: "PPI dos EUA — setembro", country: "US" },
  { date: "2026-10-28", title: "Decisão de juros do Fed (FOMC)", country: "US" },
  { date: "2026-10-29", title: "Copom — decisão Selic", country: "BR" },
  { date: "2026-11-04", title: "ADP Emprego (privado) — outubro", country: "US" },
  { date: "2026-11-06", title: "Payroll (NFP) + Desemprego — outubro", country: "US" },
  { date: "2026-11-12", title: "CPI dos EUA — outubro", country: "US" },
  { date: "2026-11-13", title: "PPI dos EUA — outubro", country: "US" },
  { date: "2026-12-02", title: "ADP Emprego (privado) — novembro", country: "US" },
  { date: "2026-12-04", title: "Payroll (NFP) + Desemprego — novembro", country: "US" },
  { date: "2026-12-09", title: "Copom — decisão Selic", country: "BR" },
  { date: "2026-12-10", title: "CPI dos EUA — novembro", country: "US" },
  { date: "2026-12-11", title: "PPI dos EUA — novembro", country: "US" },
  { date: "2026-12-16", title: "Decisão de juros do Fed (FOMC)", country: "US" },
];

export function getUpcomingEvents(daysAhead = 7): CalendarEvent[] {
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return KNOWN_EVENTS.filter((e) => {
    const d = new Date(`${e.date}T12:00:00Z`);
    return d >= now && d <= until;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// O próximo evento conhecido, sem limite de janela — pra mostrar "faltam N dias" na home
// mesmo quando não há nada dentro dos próximos 7 dias.
export function getNextEvent(): (CalendarEvent & { daysUntil: number }) | null {
  const now = new Date();
  const upcoming = KNOWN_EVENTS.filter((e) => new Date(`${e.date}T12:00:00Z`) >= now).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (upcoming.length === 0) return null;
  const next = upcoming[0];
  const daysUntil = Math.ceil(
    (new Date(`${next.date}T12:00:00Z`).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
  return { ...next, daysUntil };
}

// Só os EUA, os próximos N — pra seção "Calendário da semana" da home (pedido: CPI, PPI, ADP,
// payroll, desemprego etc, só EUA).
export function getUpcomingUSEvents(limit = 5): Array<CalendarEvent & { daysUntil: number }> {
  const now = new Date();
  return KNOWN_EVENTS.filter((e) => e.country === "US" && new Date(`${e.date}T12:00:00Z`) >= now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
    .map((e) => ({
      ...e,
      daysUntil: Math.ceil((new Date(`${e.date}T12:00:00Z`).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    }));
}
