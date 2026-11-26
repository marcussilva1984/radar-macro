"use client";

import { useEffect, useState } from "react";
import { getSectors } from "@/lib/sources/b3Stocks";

interface StockRow {
  symbol: string;
  name: string;
  sector: string;
  dividendYield12m: number;
  price: number | null;
  desconto20d: number | null;
  mma20dist: number | null;
  closes30: number[];
  momentum: "alta" | "queda" | "neutro";
}

function fmt(n: number | null | undefined, dec = 2): string {
  if (n === null || n === undefined) return "–";
  return n.toFixed(dec);
}

function pctColor(v: number | null): string {
  if (v === null) return "text-gray-400";
  if (v > 0) return "text-green-400";
  if (v < 0) return "text-red-400";
  return "text-gray-400";
}

function descontoColor(v: number | null): string {
  if (v === null) return "text-gray-400";
  if (v < -10) return "text-green-400 font-semibold";
  if (v < -5) return "text-green-300";
  return "text-gray-300";
}

function MomentumBadge({ m }: { m: StockRow["momentum"] }) {
  const cls =
    m === "alta" ? "bg-green-900/60 text-green-300" :
    m === "queda" ? "bg-red-900/60 text-red-300" :
    "bg-gray-700 text-gray-400";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{m}</span>;
}

function changePctN(closes30: number[], n: number): number | null {
  if (closes30.length < 2) return null;
  const price = closes30[closes30.length - 1];
  const idx = closes30.length - 1 - Math.min(n, closes30.length - 1);
  const base = closes30[idx];
  if (!base) return null;
  return ((price - base) / base) * 100;
}

const ALL_SECTORS = ["Todos", ...getSectors()];

export default function AcoesPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState("Todos");
  const [days, setDays] = useState(1);
  const [maxRows, setMaxRows] = useState(20);

  useEffect(() => {
    fetch("/api/acoes-board")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = (sector === "Todos" ? rows : rows.filter((r) => r.sector === sector)).slice(0, maxRows);

  // Scoreboard de setores
  const sectorMap = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const v = changePctN(r.closes30, days);
    if (v === null) continue;
    const s = r.sector;
    const cur = sectorMap.get(s) ?? { sum: 0, count: 0 };
    sectorMap.set(s, { sum: cur.sum + v, count: cur.count + 1 });
  }
  const sectorBoard = getSectors()
    .map((s) => { const d = sectorMap.get(s); return { sector: s, avg: d ? d.sum / d.count : null }; })
    .sort((a, b) => (b.avg ?? -99) - (a.avg ?? -99));

  // Ideias de entrada: desconto > 5% e momentum não é queda
  const entryIdeas = rows.filter((r) => r.desconto20d !== null && r.desconto20d < -5 && r.momentum !== "queda");

  // Top 10 dividendos
  const dividendTop = [...rows].filter((r) => r.price !== null).sort((a, b) => b.dividendYield12m - a.dividendYield12m).slice(0, 10);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-4">Ações B3</h1>
        <p className="text-gray-400">Carregando dados...</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold text-white">Ações B3</h1>

      {/* 1. Radar de Momentum */}
      <section>
        {/* Controles */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-200">Radar de Momentum</h2>

          {/* Filtro setor */}
          <div className="flex gap-1 flex-wrap">
            {ALL_SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => setSector(s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  sector === s
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-600 text-gray-400 hover:border-gray-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Qtd de ativos */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-400">Ativos:</span>
            <input
              type="range"
              min={5}
              max={rows.length}
              step={5}
              value={maxRows}
              onChange={(e) => setMaxRows(Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <span className="text-xs font-mono text-blue-400 w-6">{maxRows}</span>
          </div>

          {/* Slider dias */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Variação:</span>
            <input
              type="range"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-28 accent-blue-500"
            />
            <span className="text-xs font-mono text-blue-400 w-10">{days}D</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Ativo</th>
                <th className="pb-2 pr-4">Setor</th>
                <th className="pb-2 pr-4 text-right">Preço</th>
                <th className="pb-2 pr-4 text-right">Var {days}D</th>
                <th className="pb-2 pr-4 text-right" title="% abaixo da máxima dos últimos 20 pregões">Desc. 20d</th>
                <th className="pb-2 pr-4 text-right" title="% acima/abaixo da média móvel de 20 dias">MM20 dist.</th>
                <th className="pb-2">Momentum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const varNd = changePctN(r.closes30, days);
                return (
                  <tr key={r.symbol} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 font-mono text-white">{r.symbol}</td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">{r.sector}</td>
                    <td className="py-2 pr-4 text-right text-gray-200">
                      {r.price ? `R$ ${fmt(r.price)}` : "–"}
                    </td>
                    <td className={`py-2 pr-4 text-right font-semibold ${pctColor(varNd)}`}>
                      {varNd !== null ? `${varNd > 0 ? "+" : ""}${fmt(varNd)}%` : "–"}
                    </td>
                    <td className={`py-2 pr-4 text-right ${descontoColor(r.desconto20d)}`}>
                      {r.desconto20d !== null ? `${fmt(r.desconto20d)}%` : "–"}
                    </td>
                    <td className={`py-2 pr-4 text-right ${pctColor(r.mma20dist)}`}>
                      {r.mma20dist !== null ? `${r.mma20dist > 0 ? "+" : ""}${fmt(r.mma20dist)}%` : "–"}
                    </td>
                    <td className="py-2"><MomentumBadge m={r.momentum} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Desc. 20d = % abaixo da máxima dos últimos 20 pregões. Verde = desconto &gt; 10%, claro = &gt; 5%.
        </p>
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
                <tr key={r.symbol} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 font-mono text-white">{r.symbol}</td>
                  <td className="py-2 pr-4 text-gray-300">{r.name}</td>
                  <td className="py-2 pr-4 text-gray-400">{r.sector}</td>
                  <td className="py-2 text-right text-green-400 font-semibold">{r.dividendYield12m}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Scoreboard de Setores */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-1">Scoreboard de Setores</h2>
        <p className="text-xs text-gray-500 mb-3">Variação média no período selecionado ({days}D).</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sectorBoard.map(({ sector: s, avg }) => (
            <div
              key={s}
              className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 cursor-pointer hover:border-blue-500 transition-colors"
              onClick={() => setSector(sector === s ? "Todos" : s)}
            >
              <div className="text-xs text-gray-400 mb-1">{s}</div>
              <div className={`text-lg font-bold ${pctColor(avg)}`}>
                {avg !== null ? `${avg > 0 ? "+" : ""}${fmt(avg)}%` : "–"}
              </div>
              <div className="text-xs text-gray-500">média {days}D</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Clique no setor para filtrar a tabela acima.</p>
      </section>

      {/* 4. Ideias de Entrada */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Ideias de Entrada</h2>
        <p className="text-xs text-gray-500 mb-3">
          Desconto &gt; 5% da máxima dos últimos 20 pregões e momentum não negativo.
        </p>
        {entryIdeas.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma ação na zona de entrada no momento.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {entryIdeas.map((r) => (
              <div key={r.symbol} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-white">{r.symbol}</span>
                  <MomentumBadge m={r.momentum} />
                </div>
                <div className="text-sm text-gray-400 mb-2">{r.name}</div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Desc. 20d: <span className={descontoColor(r.desconto20d)}>{r.desconto20d !== null ? `${fmt(r.desconto20d)}%` : "–"}</span></div>
                  <div>MM20: <span className={pctColor(r.mma20dist)}>{r.mma20dist !== null ? `${r.mma20dist > 0 ? "+" : ""}${fmt(r.mma20dist)}%` : "–"}</span></div>
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
