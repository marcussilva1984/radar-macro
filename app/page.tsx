import { getRecentTimeline } from "@/lib/timeline";
import { getMentionsTrend } from "@/lib/mentions";
import { getTensionIndex } from "@/lib/tensionIndex";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";

export const dynamic = "force-dynamic";

const FLOW_LABEL = Object.fromEntries(FLOW_SYMBOLS.map((s) => [s.symbol, s.label]));

const CATEGORY_LABEL: Record<string, string> = {
  central_bank: "Banco Central",
  geopolitics: "Geopolítica",
  macro_data: "Dado Macro",
};

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

const VISIBLE_EVENTS = 8;

export default async function Home() {
  let entries: Awaited<ReturnType<typeof getRecentTimeline>> = [];
  let mentions: Awaited<ReturnType<typeof getMentionsTrend>> = [];
  let tension: Awaited<ReturnType<typeof getTensionIndex>> | null = null;
  let error: string | null = null;

  try {
    [entries, mentions, tension] = await Promise.all([
      getRecentTimeline(14),
      getMentionsTrend(),
      getTensionIndex(),
    ]);
  } catch (e) {
    error = (e as Error).message;
  }

  // Ordena por relevância (maior |surpresa| entre os ativos que reagiram), não por hora —
  // o que mais moveu o mercado aparece primeiro, cronologia vira critério secundário.
  const ranked = [...entries].sort((a, b) => {
    const maxA = Math.max(0, ...a.moves.map((m) => Math.abs(m.surprise ?? 0)));
    const maxB = Math.max(0, ...b.moves.map((m) => Math.abs(m.surprise ?? 0)));
    if (maxA !== maxB) return maxB - maxA;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });
  const visible = ranked.slice(0, VISIBLE_EVENTS);
  const rest = ranked.slice(VISIBLE_EVENTS);

  function renderEvent(e: (typeof ranked)[number]) {
    return (
      <li
        key={e.id}
        className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            {CATEGORY_LABEL[e.category] ?? e.category}
          </span>
          <span>{e.country}</span>
          <span>{e.publishedAt.toLocaleString("pt-BR")}</span>
          {e.duplicateCount > 0 && (
            <span title="Mesmo assunto noticiado por outras fontes, agrupado aqui">
              +{e.duplicateCount} fonte{e.duplicateCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <a
          href={e.sourceUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block font-medium text-black hover:underline dark:text-zinc-50"
        >
          {e.title}
        </a>
        {e.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {e.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        {e.moves.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {e.moves.map((m) => (
              <span
                key={m.symbol}
                title={m.surprise !== null ? `z-score: ${m.surprise.toFixed(1)}` : undefined}
                className={
                  (m.changePct ?? 0) >= 0
                    ? "rounded bg-green-50 px-1.5 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "rounded bg-red-50 px-1.5 py-0.5 text-red-700 dark:bg-red-950 dark:text-red-300"
                }
              >
                {m.label} {m.changePct?.toFixed(2)}%
                {m.surprise !== null && Math.abs(m.surprise) > 1.5 ? " ⚡" : ""}
              </span>
            ))}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Radar Semanal</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Foco: EUA (Fed, política, comércio), macroeconomia, geopolítica, criptoativos e bancos
          centrais — o que moveu os ativos de fluxo (DXY, ouro, treasuries, BTC, S&amp;P) no dia
          seguinte.
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

            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:grid-cols-2">
              {tension.topForexIdea && (
                <p>
                  <span className="font-medium text-zinc-500">Forex:</span>{" "}
                  {tension.topForexIdea.title}
                </p>
              )}
              {tension.topCorrelationBreak && (
                <p>
                  <span className="font-medium text-zinc-500">Correlação:</span>{" "}
                  {FLOW_LABEL[tension.topCorrelationBreak.a]} × {FLOW_LABEL[tension.topCorrelationBreak.b]}
                  {(tension.topCorrelationBreak.shift ?? 0) > 0.2 ? " (quebrando)" : " (estável)"}
                </p>
              )}
              {tension.topFlowNode && (
                <p>
                  <span className="font-medium text-zinc-500">Fluxo:</span> {tension.topFlowNode.label}{" "}
                  {tension.topFlowNode.weeklyChangePct >= 0 ? "+" : ""}
                  {tension.topFlowNode.weeklyChangePct.toFixed(2)}% na semana
                </p>
              )}
              {tension.nextEvent && (
                <p>
                  <span className="font-medium text-zinc-500">Próximo evento:</span>{" "}
                  {tension.nextEvent.title} em {tension.nextEvent.daysUntil} dia
                  {tension.nextEvent.daysUntil !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {!error && mentions.length > 0 && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500">
              Radar de menções — qual narrativa está ganhando força essa semana
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mentions.slice(0, 12).map((m) => (
                <span
                  key={m.tag}
                  className={
                    m.changePct !== null && m.changePct > 30
                      ? "rounded bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }
                >
                  #{m.tag} {m.thisWeek}
                  {m.changePct !== null && (m.changePct > 0 ? ` +${m.changePct.toFixed(0)}%` : ` ${m.changePct.toFixed(0)}%`)}
                </span>
              ))}
            </div>
          </div>
        )}

        {!error && entries.length === 0 && (
          <p className="mt-8 text-sm text-zinc-500">
            Nenhum evento ainda. Rode <code>/api/cron/ingest-events</code> e{" "}
            <code>/api/cron/ingest-flows</code> para popular.
          </p>
        )}

        <ul className="mt-8 space-y-4">{visible.map(renderEvent)}</ul>

        {rest.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-zinc-500 hover:text-black dark:hover:text-zinc-50">
              Ver mais {rest.length} evento{rest.length > 1 ? "s" : ""} de menor relevância
            </summary>
            <ul className="mt-4 space-y-4">{rest.map(renderEvent)}</ul>
          </details>
        )}
      </main>
    </div>
  );
}
