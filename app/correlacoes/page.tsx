import { getCorrelationShifts } from "@/lib/correlations";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";

export const dynamic = "force-dynamic";

const LABEL = Object.fromEntries(FLOW_SYMBOLS.map((s) => [s.symbol, s.label]));

// mesmo esquema de cor da aba Forex: forte = vermelho, médio = amarelo, fraco = azul.
const CONVICTION_STYLE: Record<string, string> = {
  forte: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950",
  médio: "border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950",
  fraco: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950",
};
const CONVICTION_BADGE: Record<string, string> = {
  forte: "bg-red-600 text-white",
  médio: "bg-yellow-500 text-black",
  fraco: "bg-blue-500 text-white",
};
const CONVICTION_TEXT: Record<string, string> = {
  forte: "text-red-900 dark:text-red-200",
  médio: "text-yellow-900 dark:text-yellow-200",
  fraco: "text-blue-900 dark:text-blue-200",
};

function convictionOf(shift: number | null): "forte" | "médio" | "fraco" {
  if (shift === null) return "fraco";
  if (shift > 0.4) return "forte";
  if (shift > 0.2) return "médio";
  return "fraco";
}

function corrDescription(v: number | null): string {
  if (v === null) return "sem dado";
  const abs = Math.abs(v);
  const strength = abs > 0.6 ? "forte" : abs > 0.3 ? "moderada" : "fraca";
  const direction = v >= 0 ? "positiva (andam juntos)" : "negativa (andam opostos)";
  return `${strength} ${direction}`;
}

function buildIdeaText(a: string, b: string, corr7d: number | null, corr30d: number | null, shift: number | null): string {
  if (shift === null || corr7d === null || corr30d === null) {
    return "Histórico insuficiente pra comparar 7d vs 30d ainda.";
  }
  if (shift <= 0.2) {
    return `Relação estável: ${a} e ${b} continuam se comportando como historicamente (correlação 30d ${corrDescription(corr30d)}). Nada de novo pra atenção aqui.`;
  }
  const changedTo = corr7d >= 0 ? "positiva (andando juntos)" : "negativa (andando opostos)";
  return `Na última semana, ${a} e ${b} passaram a andar de forma ${changedTo}, diferente do padrão de 30 dias (${corrDescription(corr30d)}). Isso costuma indicar que uma narrativa nova está dominando o mercado — vale checar o que mudou (fala de banco central, dado macro, evento geopolítico) antes de assumir que é só ruído.`;
}

export default async function CorrelacoesPage() {
  let shifts: Awaited<ReturnType<typeof getCorrelationShifts>> = [];
  let error: string | null = null;
  try {
    shifts = await getCorrelationShifts();
  } catch (e) {
    error = (e as Error).message;
  }

  const order = { forte: 0, médio: 1, fraco: 2 };
  const sorted = [...shifts].sort((x, y) => order[convictionOf(x.shift)] - order[convictionOf(y.shift)]);

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
      <p className="mt-1 text-xs text-zinc-500">
        Convicção da quebra: <span className="font-medium text-red-600 dark:text-red-400">forte</span> ·{" "}
        <span className="font-medium text-yellow-600 dark:text-yellow-500">médio</span> ·{" "}
        <span className="font-medium text-blue-600 dark:text-blue-400">fraco (estável)</span>.
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}

      {!error && (
        <ul className="mt-6 space-y-3">
          {sorted.map((s) => {
            const conviction = convictionOf(s.shift);
            return (
              <li
                key={`${s.a}-${s.b}`}
                className={`rounded-lg border p-4 ${CONVICTION_STYLE[conviction]}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${CONVICTION_BADGE[conviction]}`}
                  >
                    {conviction}
                  </span>
                  <span className={`font-medium ${CONVICTION_TEXT[conviction]}`}>
                    {LABEL[s.a]} × {LABEL[s.b]}
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-sm">
                  <span className={CONVICTION_TEXT[conviction]}>7d: {s.corr7d?.toFixed(2) ?? "—"}</span>
                  <span className={`opacity-70 ${CONVICTION_TEXT[conviction]}`}>
                    30d: {s.corr30d?.toFixed(2) ?? "—"}
                  </span>
                </div>
                <p className={`mt-2 text-sm opacity-90 ${CONVICTION_TEXT[conviction]}`}>
                  {buildIdeaText(LABEL[s.a], LABEL[s.b], s.corr7d, s.corr30d, s.shift)}
                </p>
              </li>
            );
          })}
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
