import { getForexBoard } from "@/lib/forex";
import { POLICY_RATES_UPDATED_AT } from "@/lib/sources/policyRates";

export const dynamic = "force-dynamic";

const SIGNAL_STYLE: Record<string, string> = {
  alta: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  queda: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  estabilização: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function changeColor(v: number | null) {
  if (v === null) return "text-zinc-400";
  return v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function bar(score: number, max: number) {
  const pct = max === 0 ? 0 : Math.min(100, (Math.abs(score) / max) * 100);
  return (
    <div className="h-1.5 w-24 rounded bg-zinc-100 dark:bg-zinc-800">
      <div
        className={score >= 0 ? "h-1.5 rounded bg-green-500" : "h-1.5 rounded bg-red-500"}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default async function ForexPage() {
  let strength: Awaited<ReturnType<typeof getForexBoard>>["strength"] = [];
  let signals: Awaited<ReturnType<typeof getForexBoard>>["signals"] = [];
  let ideas: Awaited<ReturnType<typeof getForexBoard>>["ideas"] = [];
  let error: string | null = null;

  try {
    ({ strength, signals, ideas } = await getForexBoard());
  } catch (e) {
    error = (e as Error).message;
  }

  const maxStrength = Math.max(0.01, ...strength.map((s) => Math.abs(s.score)));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Forex</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Força relativa das moedas (diário e semanal) + assimetria de triangulação + viés de carry
        (juros atualizados manualmente em {POLICY_RATES_UPDATED_AT}). Heurística de leitura de
        fluxo, não recomendação de entrada/saída.
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Configure <code>DATABASE_URL</code> e rode <code>/api/cron/ingest-forex</code>. ({error})
        </div>
      )}

      {!error && ideas.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-medium text-black dark:text-zinc-50">
            Ideias da semana
          </h2>
          <ul className="mt-3 space-y-2">
            {ideas.map((idea, i) => (
              <li
                key={i}
                className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950"
              >
                <p className="font-medium text-blue-900 dark:text-blue-200">{idea.title}</p>
                <p className="mt-1 text-blue-800/80 dark:text-blue-300/80">{idea.detail}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {!error && (
        <>
          <h2 className="mt-10 text-lg font-medium text-black dark:text-zinc-50">
            Força relativa das moedas (hoje)
          </h2>
          <ul className="mt-3 space-y-2">
            {strength.map((s) => (
              <li key={s.currency} className="flex items-center gap-3 text-sm">
                <span className="w-10 font-mono text-zinc-700 dark:text-zinc-300">{s.currency}</span>
                {bar(s.score, maxStrength)}
                <span className={`text-xs ${changeColor(s.score)}`}>{s.score.toFixed(2)}%</span>
              </li>
            ))}
            {strength.length === 0 && (
              <p className="text-sm text-zinc-500">
                Sem dados ainda — rode <code>/api/cron/ingest-forex</code>.
              </p>
            )}
          </ul>

          <h2 className="mt-10 text-lg font-medium text-black dark:text-zinc-50">
            Pares — sinal combinado
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-4">Par</th>
                  <th className="py-2 pr-4">Var. dia</th>
                  <th className="py-2 pr-4">Var. semana</th>
                  <th className="py-2 pr-4">Carry</th>
                  <th className="py-2 pr-4">Assimetria</th>
                  <th className="py-2">Sinal</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.pair} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4 font-medium text-black dark:text-zinc-50">
                      {s.base}/{s.quote}
                      {s.trendConsistent && (
                        <span
                          title="Diário e semanal apontam na mesma direção"
                          className="ml-1 text-amber-500"
                        >
                          ★
                        </span>
                      )}
                    </td>
                    <td className={`py-2 pr-4 ${changeColor(s.changePct)}`}>
                      {s.changePct !== null ? `${s.changePct.toFixed(2)}%` : "—"}
                    </td>
                    <td className={`py-2 pr-4 ${changeColor(s.weeklyChangePct)}`}>
                      {s.weeklyChangePct !== null ? `${s.weeklyChangePct.toFixed(2)}%` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                      {s.carryDiff.toFixed(2)}pp
                    </td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                      {s.asymmetry !== null ? s.asymmetry.toFixed(2) : "—"}
                    </td>
                    <td className="py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${SIGNAL_STYLE[s.signal]}`}>
                        {s.signal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {signals.length === 0 && (
              <p className="mt-4 text-sm text-zinc-500">
                Sem dados ainda — rode <code>/api/cron/ingest-forex</code>.
              </p>
            )}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            ★ = tendência consistente (diário e semanal na mesma direção) — sinal mais forte que
            um movimento de um dia só.
          </p>
        </>
      )}
    </div>
  );
}
