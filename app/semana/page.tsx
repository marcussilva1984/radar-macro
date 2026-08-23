import { getLastTwoWeeklySummaries } from "@/lib/weeklySummary";

export const dynamic = "force-dynamic";

export default async function SemanaPage() {
  let weeks: Awaited<ReturnType<typeof getLastTwoWeeklySummaries>> = [];
  let error: string | null = null;
  try {
    weeks = await getLastTwoWeeklySummaries();
  } catch (e) {
    error = (e as Error).message;
  }

  const [current, previous] = weeks;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Resumo da semana</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Gerado automaticamente toda sexta (cron <code>/api/cron/weekly-summary</code>): os
        eventos de maior desvio estatístico da semana + o calendário macro conhecido pra semana
        seguinte.
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}

      {!error && !current && (
        <p className="mt-8 text-sm text-zinc-500">
          Nenhum resumo gerado ainda. Rode <code>/api/cron/weekly-summary</code> manualmente pra
          ver o primeiro.
        </p>
      )}

      {current && (
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Semana atual — {current.weekStart.toLocaleDateString("pt-BR")}
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-blue-950 dark:text-blue-100">
            {current.summary}
          </pre>
        </div>
      )}

      {previous && (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500">
            Semana anterior — {previous.weekStart.toLocaleDateString("pt-BR")}
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">
            {previous.summary}
          </pre>
        </div>
      )}
    </div>
  );
}
