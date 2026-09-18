import { getLastTwoWeeklySummaries } from "@/lib/weeklySummary";
import { getB3Ideas } from "@/lib/b3Ideas";

const CONVICTION_STYLE: Record<string, string> = {
  forte: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950",
  médio: "border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950",
};
const CONVICTION_BADGE: Record<string, string> = {
  forte: "bg-red-600 text-white",
  médio: "bg-yellow-500 text-black",
};
const CONVICTION_TEXT: Record<string, string> = {
  forte: "text-red-900 dark:text-red-200",
  médio: "text-yellow-900 dark:text-yellow-200",
};

export const dynamic = "force-dynamic";

export default async function SemanaPage() {
  let weeks: Awaited<ReturnType<typeof getLastTwoWeeklySummaries>> = [];
  let error: string | null = null;
  try {
    weeks = await getLastTwoWeeklySummaries();
  } catch (e) {
    error = (e as Error).message;
  }

  let b3: Awaited<ReturnType<typeof getB3Ideas>> = [];
  try {
    b3 = await getB3Ideas();
  } catch {
    // tabela ainda vazia/indisponível — a seção só não aparece
  }
  const byStrength = (a: (typeof b3)[number], b: (typeof b3)[number]) =>
    (a.conviction === b.conviction ? 0 : a.conviction === "forte" ? -1 : 1) || Math.abs(b.score) - Math.abs(a.score);
  const acoes = b3.filter((i) => i.kind === "acao").sort(byStrength).slice(0, 8);
  const fiis = b3.filter((i) => i.kind === "fii").sort(byStrength).slice(0, 8);

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

      {[
        { title: "Ideias fortes — Ações (B3)", items: acoes },
        { title: "Ideias fortes — FIIs", items: fiis },
      ].map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.title} className="mt-10">
              <h2 className="text-lg font-medium text-black dark:text-zinc-50">{group.title}</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Só papéis líquidos da B3. Forte = tendência diária e semanal alinhadas com fluxo
                (força vs Ibovespa) e, nos FIIs, dividend yield + desconto da cota. Heurística de
                leitura, não recomendação de investimento.
              </p>
              <ul className="mt-3 space-y-2">
                {group.items.map((i) => (
                  <li
                    key={i.id}
                    className={`rounded-lg border p-3 text-sm ${CONVICTION_STYLE[i.conviction]}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${CONVICTION_BADGE[i.conviction]}`}
                      >
                        {i.conviction}
                      </span>
                      <p className={`font-medium ${CONVICTION_TEXT[i.conviction]}`}>{i.title}</p>
                    </div>
                    <p className={`mt-1 opacity-80 ${CONVICTION_TEXT[i.conviction]}`}>{i.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          )
      )}
    </div>
  );
}
