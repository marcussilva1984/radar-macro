// Calendário de eventos macro recorrentes conhecidos com antecedência (reuniões de bancos
// centrais, payroll/CPI dos EUA). Datas aproximadas — atualize conforme o calendário oficial
// (federalreserve.gov, bcb.gov.br, ecb.europa.eu) muda. Diferente da timeline principal (que é
// só o que já aconteceu, via RSS), isso é usado pra gerar a seção "o que esperar" do resumo
// semanal — o único jeito de saber o que vem *antes* de acontecer sem uma API paga de calendário.
export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  title: string;
  country: string;
}

export const KNOWN_EVENTS: CalendarEvent[] = [
  { date: "2026-09-04", title: "Payroll (NFP) dos EUA — agosto", country: "US" },
  { date: "2026-09-10", title: "CPI dos EUA — agosto", country: "US" },
  { date: "2026-09-16", title: "Decisão de juros do Fed (FOMC)", country: "US" },
  { date: "2026-09-23", title: "Copom — decisão Selic", country: "BR" },
  { date: "2026-10-02", title: "Payroll (NFP) dos EUA — setembro", country: "US" },
  { date: "2026-10-13", title: "CPI dos EUA — setembro", country: "US" },
  { date: "2026-10-28", title: "Decisão de juros do Fed (FOMC)", country: "US" },
  { date: "2026-10-29", title: "Copom — decisão Selic", country: "BR" },
  { date: "2026-11-06", title: "Payroll (NFP) dos EUA — outubro", country: "US" },
  { date: "2026-11-12", title: "CPI dos EUA — outubro", country: "US" },
  { date: "2026-12-04", title: "Payroll (NFP) dos EUA — novembro", country: "US" },
  { date: "2026-12-09", title: "Copom — decisão Selic", country: "BR" },
  { date: "2026-12-10", title: "CPI dos EUA — novembro", country: "US" },
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
