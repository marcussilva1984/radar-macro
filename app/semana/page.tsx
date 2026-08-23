import { getLatestWeeklySummary } from "@/lib/weeklySummary";

export const dynamic = "force-dynamic";

export default async function SemanaPage() {
  let summary: Awaited<ReturnType<typeof getLatestWeeklySummary>> | null = null;
  let error: string | null = null;
  try {
    summary = await getLatestWeeklySummary();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Resumo da semana</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Gerado automaticamente toda semana (cron <code>/api/cron/weekly-summary</code>) a partir
        dos eventos com maior desvio estatístico nos ativos de fluxo.
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}

      {!error && !summary && (
        <p className="mt-8 text-sm text-zinc-500">
          Nenhum resumo gerado ainda. Rode <code>/api/cron/weekly-summary</code> manualmente pra
          ver o primeiro.
        </p>
      )}

      {summary && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs text-zinc-500">
            Semana de {summary.weekStart.toLocaleDateString("pt-BR")}
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-zinc-800 dark:text-zinc-200">
            {summary.summary}
          </pre>
        </div>
      )}
    </div>
  );
}
