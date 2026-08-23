import { getTensionIndex } from "@/lib/tensionIndex";
import { getFearGreedIndex } from "@/lib/sources/fearGreed";
import { getUpcomingUSEvents } from "@/lib/sources/economicCalendar";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";

export const dynamic = "force-dynamic";

const FLOW_LABEL = Object.fromEntries(FLOW_SYMBOLS.map((s) => [s.symbol, s.label]));

const TENSION_STYLE: Record<string, string> = {
  alta: "text-red-600 dark:text-red-400",
  média: "text-yellow-600 dark:text-yellow-500",
  baixa: "text-green-600 dark:text-green-400",
};
const TENSION_BAR: Record<string, string> = {
  alta: "bg-red-500",
  média: "bg-yellow-500",
  baixa: "bg-green-500",
};

// Cor por faixa do índice de medo/ganância (0-100): vermelho = medo extremo, verde = ganância extrema.
function fearGreedColor(value: number): string {
  if (value <= 24) return "text-red-600 dark:text-red-400";
  if (value <= 44) return "text-orange-500 dark:text-orange-400";
  if (value <= 55) return "text-zinc-500 dark:text-zinc-400";
  if (value <= 75) return "text-lime-600 dark:text-lime-400";
  return "text-green-600 dark:text-green-400";
}
function fearGreedBar(value: number): string {
  if (value <= 24) return "bg-red-500";
  if (value <= 44) return "bg-orange-500";
  if (value <= 55) return "bg-zinc-400";
  if (value <= 75) return "bg-lime-500";
  return "bg-green-500";
}
const FEAR_GREED_LABEL: Record<string, string> = {
  "Extreme Fear": "Medo extremo",
  Fear: "Medo",
  Neutral: "Neutro",
  Greed: "Ganância",
  "Extreme Greed": "Ganância extrema",
};

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-black dark:text-zinc-50">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function Home() {
  let tension: Awaited<ReturnType<typeof getTensionIndex>> | null = null;
  let fearGreed: Awaited<ReturnType<typeof getFearGreedIndex>> = null;
  let error: string | null = null;
  const usEvents = getUpcomingUSEvents(6);

  try {
    [tension, fearGreed] = await Promise.all([getTensionIndex(), getFearGreedIndex()]);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Radar Semanal</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Foco: EUA (Fed, política, comércio), macroeconomia, geopolítica, criptoativos e bancos
          centrais — leitura de fluxo e narrativa, não notícia crua (isso já tem no Terminal de
          Mercado).
        </p>

        {error && (
          <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            Configure <code>DATABASE_URL</code> em <code>.env.local</code> e rode os crons de
            ingestão para ver dados aqui. ({error})
          </div>
        )}

        {tension && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Índice de Tensão do Radar</p>
              <span className={`text-2xl font-bold ${TENSION_STYLE[tension.level]}`}>
                {tension.score}
                <span className="text-sm font-normal opacity-60">/100</span>
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-2 rounded ${TENSION_BAR[tension.level]}`}
                style={{ width: `${tension.score}%` }}
              />
            </div>
            <p className={`mt-2 text-sm font-medium ${TENSION_STYLE[tension.level]}`}>
              Tensão {tension.level}: {tension.headline}
            </p>
          </div>
        )}

        {fearGreed && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Medo &amp; Ganância (cripto)</p>
              <span className={`text-2xl font-bold ${fearGreedColor(fearGreed.value)}`}>
                {fearGreed.value}
                <span className="text-sm font-normal opacity-60">/100</span>
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-2 rounded ${fearGreedBar(fearGreed.value)}`}
                style={{ width: `${fearGreed.value}%` }}
              />
            </div>
            <p className={`mt-2 text-sm font-medium ${fearGreedColor(fearGreed.value)}`}>
              {FEAR_GREED_LABEL[fearGreed.classification] ?? fearGreed.classification}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Fonte: alternative.me · atualizado {fearGreed.timestamp.toLocaleDateString("pt-BR")}
            </p>
          </div>
        )}

        {tension && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-zinc-500">Semana em números</p>
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Maior movimento"
                value={
                  tension.topFlowNode
                    ? `${tension.topFlowNode.label} ${tension.topFlowNode.weeklyChangePct >= 0 ? "+" : ""}${tension.topFlowNode.weeklyChangePct.toFixed(1)}%`
                    : "—"
                }
                sub="no Mapa de Fluxo, na semana"
              />
              <StatTile
                label="Ideias fortes"
                value={`${tension.forteIdeasCount} de ${tension.totalIdeasCount}`}
                sub="convicção forte no Forex"
              />
              <StatTile
                label="Maior quebra"
                value={
                  tension.topCorrelationBreak
                    ? `${FLOW_LABEL[tension.topCorrelationBreak.a]} × ${FLOW_LABEL[tension.topCorrelationBreak.b]}`
                    : "—"
                }
                sub={
                  tension.topCorrelationBreak
                    ? `shift ${(tension.topCorrelationBreak.shift ?? 0).toFixed(2)}`
                    : "sem dado"
                }
              />
              <StatTile
                label="Próximo evento"
                value={tension.nextEvent ? `${tension.nextEvent.daysUntil}d` : "—"}
                sub={tension.nextEvent?.title}
              />
            </div>
          </div>
        )}

        {usEvents.length > 0 && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500">
              Calendário da semana (EUA) — CPI, PPI, ADP, payroll, desemprego
            </p>
            <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
              {usEvents.map((e) => (
                <li key={e.date + e.title} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-zinc-700 dark:text-zinc-300">{e.title}</span>
                  <span
                    className={
                      e.daysUntil <= 2
                        ? "rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }
                  >
                    {e.daysUntil === 0 ? "hoje" : e.daysUntil === 1 ? "amanhã" : `${e.daysUntil}d`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
