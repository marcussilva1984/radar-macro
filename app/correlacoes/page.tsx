import { getCorrelationShifts } from "@/lib/correlations";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";

export const dynamic = "force-dynamic";

const LABEL = Object.fromEntries(FLOW_SYMBOLS.map((s) => [s.symbol, s.label]));

function corrLabel(v: number | null): string {
  if (v === null) return "sem dado";
  const abs = Math.abs(v);
  const strength = abs > 0.6 ? "forte" : abs > 0.3 ? "moderada" : "fraca";
  const direction = v >= 0 ? "positiva (andam juntos)" : "negativa (andam opostos)";
  return `${strength} ${direction}`;
}

function corrCellStyle(v: number | null): string {
  if (v === null) return "text-zinc-400";
  if (v > 0.3) return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";
  if (v < -0.3) return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return "bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400";
}

function shiftStyle(shift: number | null): string {
  if (shift === null) return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800";
  if (shift > 0.4) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  if (shift > 0.2) return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300";
  return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500";
}

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
        Como cada par de ativos anda junto (ou opostos) nos últimos 7 dias comparado com os
        últimos 30. Quando os dois números divergem muito, a relação &quot;de sempre&quot; entre
        essas duas classes mudou nesta semana — isso costuma indicar uma narrativa nova no
        mercado, não só ruído.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-green-500" /> correlação positiva (andam juntos)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-red-500" /> correlação negativa (andam opostos)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-400" /> quebra relevante (mudou essa semana)
        </span>
      </div>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}

      {!error && (
        <ul className="mt-6 space-y-3">
          {shifts.map((s) => (
            <li
              key={`${s.a}-${s.b}`}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-black dark:text-zinc-50">
                  {LABEL[s.a]} × {LABEL[s.b]}
                </span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${shiftStyle(s.shift)}`}>
                  {s.shift !== null
                    ? s.shift > 0.4
                      ? "quebrou essa semana"
                      : s.shift > 0.2
                        ? "mudando"
                        : "estável"
                    : "sem dado"}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <span className={`rounded px-2 py-1 ${corrCellStyle(s.corr7d)}`}>
                  7d: {s.corr7d?.toFixed(2) ?? "—"}
                </span>
                <span className={`rounded px-2 py-1 ${corrCellStyle(s.corr30d)}`}>
                  30d: {s.corr30d?.toFixed(2) ?? "—"}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Últimos 30 dias: correlação {corrLabel(s.corr30d)}.
              </p>
            </li>
          ))}
          {shifts.length === 0 && (
            <p className="mt-4 text-sm text-zinc-500">
              Sem dados suficientes ainda — precisa de histórico de fluxo acumulado (rode o cron
              de ingest-flows por alguns dias).
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
