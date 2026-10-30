// Datas no fuso de São Paulo. O servidor do Vercel roda em UTC — sem isso, depois das 21h de
// Brasília o "hoje" vira amanhã e um lançamento feito à noite no último dia do mês cai no mês
// seguinte. Brasil não tem horário de verão desde 2019, então o offset fixo é -03:00.
const TZ = "America/Sao_Paulo";
const BR_OFFSET_HOURS = 3;

function partsOf(date: Date): { year: number; month: number; day: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return { year: y, month: m - 1, day: d };
}

export interface BrToday {
  year: number;
  month: number; // 0-11
  day: number;
  daysInMonth: number;
}

export function brToday(now: Date = new Date()): BrToday {
  const { year, month, day } = partsOf(now);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { year, month, day, daysInMonth };
}

// Instante (UTC) correspondente à meia-noite de Brasília do dia `day` do mês. `day` pode ser 0
// (último dia do mês anterior) ou passar do fim do mês — o Date.UTC normaliza.
export function brMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, BR_OFFSET_HOURS));
}

// "AAAA-MM" do mês em que a data cai, no horário de Brasília.
export function brMonthKey(date: Date): string {
  const { year, month } = partsOf(date);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}
