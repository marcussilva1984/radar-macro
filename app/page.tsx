import { getTensionIndex } from "@/lib/tensionIndex";
import { getFearGreedIndex } from "@/lib/sources/fearGreed";
import { getUpcomingUSEvents } from "@/lib/sources/economicCalendar";
import { getImportantUSEventsThisWeek, type FFEventWithCountdown } from "@/lib/sources/forexFactory";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";

const IMPACT_STYLE: Record<string, string> = {
  High: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  Medium: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

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
function fearGreedBorder(value: number): string {
  if (value <= 24) return "border-red-500";
  if (value <= 44) return "border-orange-500";
  if (value <= 55) return "border-zinc-400";
  if (value <= 75) return "border-lime-500";
  return "border-green-500";
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

function StatTile({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent: string;
}) {
  return (
    <div
      className={`rounded-lg border-t-4 bg-zinc-50 p-3 dark:bg-zinc-900 ${accent}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {icon} {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-black dark:text-zinc-50">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function Home() {
  let tension: Awaited<ReturnType<typeof getTensionIndex>> | null = null;
  let fearGreed: Awaited<ReturnType<typeof getFearGreedIndex>> = null;
  let error: string | null = null;
  let ffEvents: FFEventWithCountdown[] = [];
  let calendarSource: "forexfactory" | "manual" = "forexfactory";

  try {
    [tension, fearGreed] = await Promise.all([getTensionIndex(), getFearGreedIndex()]);
  } catch (e) {
    error = (e as Error).message;
  }

  try {
    ffEvents = await getImportantUSEventsThisWeek(10);
  } catch {
    calendarSource = "manual";
  }
  const usEvents =
    ffEvents.length > 0
      ? ffEvents.map((e) => ({
          date: e.date.toISOString(),
          title: e.title,
          impact: e.impact,
          forecast: e.forecast,
          previous: e.previous,
          daysUntil: e.daysUntil,
        }))
      : getUpcomingUSEvents(6).map((e) => ({
          date: e.date,
          title: e.title,
          impact: undefined,
          forecast: undefined,
          previous: undefined,
          daysUntil: e.daysUntil,
        }));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-black dark:text-zinc-50">
          <span className="text-3xl">📡</span> Radar Semanal
        </h1>
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
          <div className="mt-4 rounded-lg border-l-4 border-purple-500 bg-white p-4 shadow-sm dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                ⚡ Índice de Tensão do Radar
              </p>
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
          <div
            className={`mt-4 rounded-lg border-l-4 bg-white p-4 shadow-sm dark:bg-zinc-950 ${fearGreedBorder(fearGreed.value)}`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${fearGreedColor(fearGreed.value)}`}>
                😨🤑 Medo &amp; Ganância (cripto)
              </p>
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
            <p className="mb-2 text-xs font-medium text-zinc-500">📊 Semana em números</p>
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                icon="🔥"
                accent="border-orange-400"
                label="Maior movimento"
                value={
                  tension.topFlowNode
                    ? `${tension.topFlowNode.label} ${tension.topFlowNode.weeklyChangePct >= 0 ? "+" : ""}${tension.topFlowNode.weeklyChangePct.toFixed(1)}%`
                    : "—"
                }
                sub="no Mapa de Fluxo, na semana"
              />
              <StatTile
                icon="🎯"
                accent="border-red-400"
                label="Ideias fortes"
                value={`${tension.forteIdeasCount} de ${tension.totalIdeasCount}`}
                sub="convicção forte no Forex"
              />
              <StatTile
                icon="🔀"
                accent="border-amber-400"
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
                icon="📅"
                accent="border-blue-400"
                label="Próximo evento"
                value={tension.nextEvent ? `${tension.nextEvent.daysUntil}d` : "—"}
                sub={tension.nextEvent?.title}
              />
            </div>
          </div>
        )}

        {usEvents.length > 0 && (
          <div className="mt-4 rounded-lg border-l-4 border-indigo-500 bg-white p-4 shadow-sm dark:bg-zinc-950">
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              🗓️ Calendário da semana (EUA) — CPI, PPI, ADP, payroll, confiança do consumidor,
              falas do Fed etc.
            </p>
            <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
              {usEvents.map((e) => (
                <li key={e.date + e.title} className="py-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      {e.impact && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${IMPACT_STYLE[e.impact] ?? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}
                        >
                          {e.impact === "High" ? "alto" : "médio"}
                        </span>
                      )}
                      {e.title}
                    </span>
                    <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {e.daysUntil <= 0 ? "hoje" : e.daysUntil === 1 ? "amanhã" : `${e.daysUntil}d`}
                    </span>
                  </div>
                  {(e.forecast || e.previous) && (
                    <p className="mt-0.5 pl-0 text-xs text-zinc-400">
                      {e.forecast && `previsão: ${e.forecast}`}
                      {e.forecast && e.previous && " · "}
                      {e.previous && `anterior: ${e.previous}`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-zinc-400">
              Fonte: {calendarSource === "forexfactory" ? "ForexFactory (feed público)" : "calendário manual (fallback)"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
