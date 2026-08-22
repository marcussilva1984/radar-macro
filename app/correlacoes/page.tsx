import { getCorrelationShifts } from "@/lib/correlations";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";

const LABEL = Object.fromEntries(FLOW_SYMBOLS.map((s) => [s.symbol, s.label]));

export default async function CorrelacoesPage() {
  let shifts: Awaited<ReturnType<typeof getCorrelationShifts>> = [];
  let error: string | null = null;
  try {
    shifts = await getCorrelationShifts();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Correlação entre classes de ativo
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Correlação 7 dias vs. 30 dias entre os ativos de fluxo. Quando o par diverge muito
        (coluna &quot;quebra&quot;), é sinal de que a relação histórica entre essas duas classes
        mudou nesta semana — possível rotação de narrativa.
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}

      {!error && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-4">Par</th>
                <th className="py-2 pr-4">Corr. 7d</th>
                <th className="py-2 pr-4">Corr. 30d</th>
                <th className="py-2">Quebra</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={`${s.a}-${s.b}`} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 font-medium text-black dark:text-zinc-50">
                    {LABEL[s.a]} × {LABEL[s.b]}
                  </td>
                  <td className="py-2 pr-4">{s.corr7d?.toFixed(2) ?? "—"}</td>
                  <td className="py-2 pr-4">{s.corr30d?.toFixed(2) ?? "—"}</td>
                  <td
                    className={
                      (s.shift ?? 0) > 0.4
                        ? "py-2 font-semibold text-amber-600 dark:text-amber-400"
                        : "py-2 text-zinc-500"
                    }
                  >
                    {s.shift?.toFixed(2) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shifts.length === 0 && (
            <p className="mt-4 text-sm text-zinc-500">
              Sem dados suficientes ainda — precisa de histórico de fluxo acumulado (rode o cron
              de ingest-flows por alguns dias).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
