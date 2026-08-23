import { getMentionsTrend, getMentionsHeadline } from "@/lib/mentions";
import { getTensionIndex } from "@/lib/tensionIndex";
import { getFearGreedIndex } from "@/lib/sources/fearGreed";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";

export const dynamic = "force-dynamic";

const FLOW_LABEL = Object.fromEntries(FLOW_SYMBOLS.map((s) => [s.symbol, s.label]));

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

// Cor por faixa do índice de medo/ganância (0-100): vermelho = medo extremo, verde = ganância extrema.
function fearGreedColor(value: number): string {
  if (value <= 24) return "text-red-600 dark:text-red-400";
  if (value <= 44) return "text-orange-500 dark:text-orange-400";
  if (value <= 55) return "text-zinc-500 dark:text-zinc-400";
  if (value <= 75) return "text-lime-600 dark:text-lime-400";
  return "text-green-600 dark:text-green-400";
}
function fearGreedBar(value: number): string {
  if (value <= 24) return "bg-red-500";
  if (value <= 44) return "bg-orange-500";
  if (value <= 55) return "bg-zinc-400";
  if (value <= 75) return "bg-lime-500";
  return "bg-green-500";
}
const FEAR_GREED_LABEL: Record<string, string> = {
  "Extreme Fear": "Medo extremo",
  Fear: "Medo",
  Neutral: "Neutro",
  Greed: "Ganância",
  "Extreme Greed": "Ganância extrema",
};

export default async function Home() {
  let mentions: Awaited<ReturnType<typeof getMentionsTrend>> = [];
  let tension: Awaited<ReturnType<typeof getTensionIndex>> | null = null;
  let fearGreed: Awaited<ReturnType<typeof getFearGreedIndex>> = null;
  let error: string | null = null;

  try {
    [mentions, tension, fearGreed] = await Promise.all([
      getMentionsTrend(),
      getTensionIndex(),
      getFearGreedIndex(),
    ]);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Radar Semanal</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Foco: EUA (Fed, política, comércio), macroeconomia, geopolítica, criptoativos e bancos
          centrais — leitura de fluxo e narrativa, não notícia crua (isso já tem no Terminal de
          Mercado).
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

        {fearGreed && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Medo &amp; Ganância (cripto)</p>
              <span className={`text-2xl font-bold ${fearGreedColor(fearGreed.value)}`}>
                {fearGreed.value}
                <span className="text-sm font-normal opacity-60">/100</span>
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-2 rounded ${fearGreedBar(fearGreed.value)}`}
                style={{ width: `${fearGreed.value}%` }}
              />
            </div>
            <p className={`mt-2 text-sm font-medium ${fearGreedColor(fearGreed.value)}`}>
              {FEAR_GREED_LABEL[fearGreed.classification] ?? fearGreed.classification}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Fonte: alternative.me · atualizado {fearGreed.timestamp.toLocaleDateString("pt-BR")}
            </p>
          </div>
        )}

        {!error && mentions.length > 0 && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500">
              Radar de menções — qual narrativa está ganhando força essa semana
            </p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              {getMentionsHeadline(mentions)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mentions.slice(0, 12).map((m) => (
                <span
                  key={m.tag}
                  title={m.exampleTitles[0]}
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

            <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {mentions.slice(0, 3).map(
                (m) =>
                  m.exampleTitles.length > 0 && (
                    <p key={m.tag} className="text-xs text-zinc-500">
                      <span className="font-medium text-zinc-600 dark:text-zinc-400">
                        Por que &quot;{m.tag}&quot;:
                      </span>{" "}
                      &quot;{m.exampleTitles[0]}&quot;
                    </p>
                  )
              )}
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              Baseado em RSS + títulos de vídeo do YouTube — não puxamos Google Trends nem X
              (API paga/instável sem chave).
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
