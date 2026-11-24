export const dynamic = "force-dynamic";

import { getStockBoard, type StockRow } from "@/lib/b3Board";
import { getSectors } from "@/lib/sources/b3Stocks";

function fmt(n: number | null, dec = 2): string {
  if (n === null) return "–";
  return n.toFixed(dec);
}

function pctColor(v: number | null): string {
  if (v === null) return "text-gray-400";
  if (v > 0) return "text-green-400";
  if (v < 0) return "text-red-400";
  return "text-gray-400";
}

function rsiColor(rsi: number | null): string {
  if (rsi === null) return "text-gray-400";
  if (rsi > 70) return "text-red-400";
  if (rsi < 30) return "text-green-400";
  return "text-blue-400";
}

function MomentumBadge({ m }: { m: StockRow["momentum"] }) {
  const cls =
    m === "alta"
      ? "bg-green-900/60 text-green-300"
      : m === "queda"
      ? "bg-red-900/60 text-red-300"
      : "bg-gray-700 text-gray-400";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{m}</span>;
}

export default async function AcoesPage() {
  const board = await getStockBoard();
  const sectors = getSectors();

  // Radar de momentum: RSI entre 40-60 + 5d positivo = zona de entrada
  const entryIdeas = board.filter(
    (r) =>
      r.rsiDaily !== null &&
      r.rsiDaily >= 40 &&
      r.rsiDaily <= 62 &&
      r.changePct5d !== null &&
      r.changePct5d > 0.5
  );

  // Scoreboard de setores
  const sectorMap = new Map<string, { sum5d: number; count: number }>();
  for (const r of board) {
    if (r.changePct5d === null) continue;
    const s = r.stock.sector;
    const cur = sectorMap.get(s) ?? { sum5d: 0, count: 0 };
    sectorMap.set(s, { sum5d: cur.sum5d + r.changePct5d, count: cur.count + 1 });
  }
  const sectorBoard = sectors
    .map((s) => {
      const d = sectorMap.get(s);
      return { sector: s, avg5d: d ? d.sum5d / d.count : null };
    })
    .sort((a, b) => (b.avg5d ?? -99) - (a.avg5d ?? -99));

  // Dividendos: top 10 por DY estimado
  const dividendTop = [...board]
    .filter((r) => r.price !== null)
    .sort((a, b) => b.dividendYield12m - a.dividendYield12m)
    .slice(0, 10);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold text-white">Ações B3</h1>

      {/* 1. Radar de Momentum */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Radar de Momentum</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Ativo</th>
                <th className="pb-2 pr-4">Setor</th>
                <th className="pb-2 pr-4 text-right">Preço</th>
                <th className="pb-2 pr-4 text-right">1D %</th>
                <th className="pb-2 pr-4 text-right">5D %</th>
                <th className="pb-2 pr-4 text-right">RSI D</th>
                <th className="pb-2 pr-4 text-right">RSI W</th>
                <th className="pb-2">Momentum</th>
              </tr>
            </thead>
            <tbody>
              {board.map((r) => (
                <tr key={r.stock.symbol} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 font-mono text-white">{r.stock.symbol}</td>
                  <td className="py-2 pr-4 text-gray-400">{r.stock.sector}</td>
                  <td className="py-2 pr-4 text-right text-gray-200">
                    {r.price ? `R$ ${fmt(r.price)}` : "–"}
                  </td>
                  <td className={`py-2 pr-4 text-right ${pctColor(r.changePct)}`}>
                    {r.changePct !== null ? `${r.changePct > 0 ? "+" : ""}${fmt(r.changePct)}%` : "–"}
                  </td>
                  <td className={`py-2 pr-4 text-right ${pctColor(r.changePct5d)}`}>
                    {r.changePct5d !== null ? `${r.changePct5d > 0 ? "+" : ""}${fmt(r.changePct5d)}%` : "–"}
                  </td>
                  <td className={`py-2 pr-4 text-right ${rsiColor(r.rsiDaily)}`}>{fmt(r.rsiDaily, 1)}</td>
                  <td className={`py-2 pr-4 text-right ${rsiColor(r.rsiWeekly)}`}>{fmt(r.rsiWeekly, 1)}</td>
                  <td className="py-2"><MomentumBadge m={r.momentum} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Painel de Dividendos */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Painel de Dividendos</h2>
        <p className="text-xs text-gray-500 mb-3">DY estimado dos últimos 12 meses — atualizado manualmente na configuração.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Ativo</th>
                <th className="pb-2 pr-4">Nome</th>
                <th className="pb-2 pr-4">Setor</th>
                <th className="pb-2 text-right">DY 12m (est.)</th>
              </tr>
            </thead>
            <tbody>
              {dividendTop.map((r) => (
                <tr key={r.stock.symbol} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 font-mono text-white">{r.stock.symbol}</td>
                  <td className="py-2 pr-4 text-gray-300">{r.stock.name}</td>
                  <td className="py-2 pr-4 text-gray-400">{r.stock.sector}</td>
                  <td className="py-2 text-right text-green-400 font-semibold">{r.dividendYield12m}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Scoreboard de Setores */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Scoreboard de Setores</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sectorBoard.map(({ sector, avg5d }) => (
            <div key={sector} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">{sector}</div>
              <div className={`text-lg font-bold ${pctColor(avg5d)}`}>
                {avg5d !== null ? `${avg5d > 0 ? "+" : ""}${fmt(avg5d)}%` : "–"}
              </div>
              <div className="text-xs text-gray-500">média 5D</div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Ideias de Entrada */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Ideias de Entrada</h2>
        <p className="text-xs text-gray-500 mb-3">
          RSI diário entre 40-62 (zona saudável, sem sobrecompra) e momentum positivo nos últimos 5 dias.
        </p>
        {entryIdeas.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma ação na zona de entrada no momento.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {entryIdeas.map((r) => (
              <div key={r.stock.symbol} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-white">{r.stock.symbol}</span>
                  <MomentumBadge m={r.momentum} />
                </div>
                <div className="text-sm text-gray-400 mb-2">{r.stock.name}</div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div>RSI D: <span className="text-blue-400">{fmt(r.rsiDaily, 1)}</span></div>
                  <div>5D: <span className={pctColor(r.changePct5d)}>{r.changePct5d !== null ? `${r.changePct5d > 0 ? "+" : ""}${fmt(r.changePct5d)}%` : "–"}</span></div>
                  <div>DY est.: <span className="text-green-400">{r.dividendYield12m}%</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
