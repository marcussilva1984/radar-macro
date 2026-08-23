import { getRecentTimeline } from "@/lib/timeline";
import { GEOPOLITICS_KEYWORDS } from "@/lib/sources/rssEvents";
import { RELEVANCE_KEYWORDS } from "@/lib/sources/youtubeChannels";
import { TopicRequestForm } from "@/app/components/TopicRequestForm";

export const dynamic = "force-dynamic";

// União dos temas já rastreados pelas duas fontes (RSS de geopolítica + filtro de vídeos),
// sem duplicar — é a lista que aparece como "radar atual" na home.
const TRACKED_TOPICS = [...new Set([...GEOPOLITICS_KEYWORDS, ...RELEVANCE_KEYWORDS.map((k) => k.replace(/\\b/g, ""))])];

const CATEGORY_LABEL: Record<string, string> = {
  central_bank: "Banco Central",
  geopolitics: "Geopolítica",
  macro_data: "Dado Macro",
};

export default async function Home() {
  let entries: Awaited<ReturnType<typeof getRecentTimeline>> = [];
  let error: string | null = null;

  try {
    entries = await getRecentTimeline(14);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Radar Semanal</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Eventos macro/geopolíticos e como os ativos de fluxo (DXY, ouro, treasuries, BTC, S&amp;P)
          reagiram no dia seguinte.
        </p>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500">
            Temas rastreados agora ({TRACKED_TOPICS.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TRACKED_TOPICS.map((t) => (
              <span
                key={t}
                className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              >
                {t}
              </span>
            ))}
          </div>
          <TopicRequestForm />
        </div>

        {error && (
          <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            Configure <code>DATABASE_URL</code> em <code>.env.local</code> e rode os crons de
            ingestão para ver dados aqui. ({error})
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
