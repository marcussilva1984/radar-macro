import { getRecentTimeline } from "@/lib/timeline";
import { getMentionsTrend } from "@/lib/mentions";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  central_bank: "Banco Central",
  geopolitics: "Geopolítica",
  macro_data: "Dado Macro",
};

export default async function Home() {
  let entries: Awaited<ReturnType<typeof getRecentTimeline>> = [];
  let mentions: Awaited<ReturnType<typeof getMentionsTrend>> = [];
  let error: string | null = null;

  try {
    [entries, mentions] = await Promise.all([getRecentTimeline(14), getMentionsTrend()]);
  } catch (e) {
    error = (e as Error).message;
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

        <ul className="mt-8 space-y-4">
          {entries.map((e) => (
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
          ))}
        </ul>
      </main>
    </div>
  );
}
