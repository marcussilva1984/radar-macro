import { getCryptoBoard } from "@/lib/cryptoBoard";

export const dynamic = "force-dynamic";

// Mesmo esquema de cores do Forex — forte = vermelho, médio = amarelo, fraco = azul.
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

function changeColor(v: number | null) {
  if (v === null) return "text-zinc-400";
  return v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}
function pct(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function money(v: number) {
  return `$${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 4 : 2 })}`;
}

export default async function CriptoPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const { n } = await searchParams;
  const ideaCount = Math.min(30, Math.max(1, Number(n) || 10));

  let board: Awaited<ReturnType<typeof getCryptoBoard>> | null = null;
  let error: string | null = null;

  try {
    board = await getCryptoBoard();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Cripto</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        BTC como referência de tendência, força relativa por setor, medo/ganância e a narrativa
        mais comentada nos vídeos que você acompanha. Heurística de leitura, não recomendação de
        entrada/saída. Atualiza a cada carregamento da página (fontes públicas, sem cache).
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}

      {board && (
        <>
          <form method="get" className="mt-6 flex items-end gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div>
              <label htmlFor="n" className="block text-xs font-medium text-zinc-500">
                Quantas ideias/oportunidades mostrar (1 a 30)
              </label>
              <input
                id="n"
                name="n"
                type="number"
                min={1}
                max={30}
                defaultValue={ideaCount}
                className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              Aplicar
            </button>
          </form>

          {board.ideas.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-medium text-black dark:text-zinc-50">Ideias da semana</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Convicção: <span className="font-medium text-red-600 dark:text-red-400">forte</span> ·{" "}
                <span className="font-medium text-yellow-600 dark:text-yellow-500">médio</span> ·{" "}
                <span className="font-medium text-blue-600 dark:text-blue-400">fraco</span>. O
                número entre parênteses é o grau de convicção bruto.
              </p>
              <ul className="mt-3 space-y-2">
                {board.ideas.slice(0, ideaCount).map((idea, i) => (
                  <li key={i} className={`rounded-lg border p-3 text-sm ${CONVICTION_STYLE[idea.conviction]}`}>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${CONVICTION_BADGE[idea.conviction]}`}>
                        {idea.conviction} ({idea.score.toFixed(2)})
                      </span>
                      <p className={`font-medium ${CONVICTION_TEXT[idea.conviction]}`}>{idea.title}</p>
                    </div>
                    <p className={`mt-1 opacity-80 ${CONVICTION_TEXT[idea.conviction]}`}>{idea.detail}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {board.entradas.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-medium text-black dark:text-zinc-50">Melhores oportunidades (vs BTC)</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Força relativa de cada moeda contra o BTC (não contra USD) — isola o movimento
                específico do ativo do movimento geral do mercado cripto. Heurística, não
                recomendação de entrada/saída.
              </p>
              <ul className="mt-3 space-y-2">
                {board.entradas.slice(0, ideaCount).map((e, i) => (
                  <li key={i} className={`rounded-lg border p-3 text-sm ${CONVICTION_STYLE[e.conviction]}`}>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${CONVICTION_BADGE[e.conviction]}`}>
                        {e.conviction} ({e.score.toFixed(2)})
                      </span>
                      <p className={`font-medium ${CONVICTION_TEXT[e.conviction]}`}>{e.title}</p>
                    </div>
                    <p className={`mt-1 opacity-80 ${CONVICTION_TEXT[e.conviction]}`}>{e.detail}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-8 text-lg font-medium text-black dark:text-zinc-50">Preços</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-4">Moeda</th>
                  <th className="py-2 pr-4">Preço</th>
                  <th className="py-2 pr-4">24h</th>
                  <th className="py-2">7d</th>
                </tr>
              </thead>
              <tbody>
                {board.coins.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4 font-medium text-black dark:text-zinc-50">{c.symbol}</td>
                    <td className="py-2 pr-4">{money(c.price)}</td>
                    <td className={`py-2 pr-4 ${changeColor(c.changePct24h)}`}>{pct(c.changePct24h)}</td>
                    <td className={`py-2 ${changeColor(c.changePct7d)}`}>{pct(c.changePct7d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 text-lg font-medium text-black dark:text-zinc-50">Força por setor (24h)</h2>
          <p className="mt-1 text-xs text-zinc-500">Variação de market cap por categoria — mostra onde o dinheiro está entrando/saindo, não só o preço do BTC.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {board.categories.map((cat) => (
              <div key={cat.id} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs text-zinc-500">{cat.name}</p>
                <p className={`mt-1 font-medium ${changeColor(cat.marketCapChangePct24h)}`}>{pct(cat.marketCapChangePct24h)}</p>
              </div>
            ))}
          </div>

          {board.fearGreed && (
            <>
              <h2 className="mt-8 text-lg font-medium text-black dark:text-zinc-50">Medo &amp; Ganância</h2>
              <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-3xl font-semibold text-black dark:text-zinc-50">{board.fearGreed.value}/100</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{board.fearGreed.classification}</p>
              </div>
            </>
          )}

          {board.narrative.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-medium text-black dark:text-zinc-50">O que estão falando essa semana</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Frequência de temas nos títulos dos vídeos dos canais que você acompanha (últimos 7 dias).
              </p>
              <ul className="mt-3 space-y-1">
                {board.narrative.map((n) => (
                  <li key={n.topic} className="flex items-center justify-between rounded border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <span className="text-black dark:text-zinc-50">{n.topic}</span>
                    <span className="text-zinc-500">{n.count} menç{n.count > 1 ? "ões" : "ão"}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
