import type { BalanceEntry } from "@/lib/brokerPortfolio";

const BROKER_COLORS: Record<string, string> = {
  EBC: "#3b82f6",
  AXI: "#f59e0b",
  ICMarkets: "#a855f7",
  FBS: "#ec4899",
};
const TOTAL_COLOR = "#22c55e";

const WIDTH = 680;
const HEIGHT = 220;
const PAD_LEFT = 50;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

function buildSeries(entries: BalanceEntry[], brokers: readonly string[]) {
  const dates = Array.from(new Set(entries.map((e) => e.entryDate.getTime()))).sort((a, b) => a - b);
  if (dates.length === 0) return { dates: [] as number[], perBroker: {} as Record<string, number[]>, totals: [] as number[] };

  const sortedByBroker: Record<string, BalanceEntry[]> = {};
  for (const broker of brokers) {
    sortedByBroker[broker] = entries
      .filter((e) => e.broker === broker)
      .sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  }

  const perBroker: Record<string, number[]> = {};
  for (const broker of brokers) {
    let lastKnown: number | null = null;
    perBroker[broker] = dates.map((t) => {
      const match = sortedByBroker[broker].find((e) => e.entryDate.getTime() === t);
      if (match) lastKnown = match.balance;
      return lastKnown ?? 0;
    });
  }

  const totals = dates.map((_, i) => brokers.reduce((acc, b) => acc + perBroker[b][i], 0));
  return { dates, perBroker, totals };
}

function pathFor(values: number[], min: number, max: number): string {
  const n = values.length;
  if (n === 0) return "";
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = PAD_LEFT + (i / Math.max(1, n - 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
      const y = PAD_TOP + (1 - (v - min) / span) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function money(v: number) {
  return `$${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function BalanceChart({ entries, brokers }: { entries: BalanceEntry[]; brokers: readonly string[] }) {
  const { dates, perBroker, totals } = buildSeries(entries, brokers);

  if (dates.length < 2) {
    return (
      <p className="text-sm text-zinc-500">
        Precisa de pelo menos 2 datas diferentes com lançamento pra desenhar o gráfico.
      </p>
    );
  }

  const allValues = [...totals, ...brokers.flatMap((b) => perBroker[b])];
  const min = Math.min(...allValues) * 0.95;
  const max = Math.max(...allValues) * 1.05;

  const firstDate = new Date(dates[0]);
  const lastDate = new Date(dates[dates.length - 1]);

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Evolução do saldo">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = PAD_TOP + f * (HEIGHT - PAD_TOP - PAD_BOTTOM);
          const value = max - f * (max - min);
          return (
            <g key={f}>
              <line x1={PAD_LEFT} y1={y} x2={WIDTH - PAD_RIGHT} y2={y} stroke="currentColor" strokeOpacity={0.1} />
              <text x={0} y={y + 4} fontSize={10} fill="currentColor" fillOpacity={0.5}>
                {money(value)}
              </text>
            </g>
          );
        })}

        {brokers.map((broker) =>
          perBroker[broker].some((v) => v > 0) ? (
            <path
              key={broker}
              d={pathFor(perBroker[broker], min, max)}
              fill="none"
              stroke={BROKER_COLORS[broker] ?? "#999"}
              strokeWidth={1.5}
              strokeOpacity={0.6}
            />
          ) : null
        )}
        <path d={pathFor(totals, min, max)} fill="none" stroke={TOTAL_COLOR} strokeWidth={2.5} />

        <text x={PAD_LEFT} y={HEIGHT - 6} fontSize={10} fill="currentColor" fillOpacity={0.5}>
          {firstDate.toLocaleDateString("pt-BR")}
        </text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 6} fontSize={10} fill="currentColor" fillOpacity={0.5} textAnchor="end">
          {lastDate.toLocaleDateString("pt-BR")}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: TOTAL_COLOR }} />
          Total
        </span>
        {brokers.map((broker) => (
          <span key={broker} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: BROKER_COLORS[broker] ?? "#999" }} />
            {broker}
          </span>
        ))}
      </div>
    </div>
  );
}
