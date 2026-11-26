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

type SortKey = "symbol" | "sector" | "price" | "varNd" | "desconto20d" | "mma20dist" | "dividendYield12m" | "momentum";
type SortDir = "asc" | "desc";

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

const MOMENTUM_ORDER = { alta: 0, neutro: 1, queda: 2 };

function SortArrow({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <span className="ml-1 text-gray-600">↕</span>;
  return <span className="ml-1 text-blue-400">{dir === "asc" ? "↑" : "↓"}</span>;
}

function Th({ label, col, sortKey, dir, onSort, className = "" }: {
  label: string; col: SortKey; sortKey: SortKey; dir: SortDir;
  onSort: (c: SortKey) => void; className?: string;
}) {
  return (
    <th
      className={`pb-2 pr-4 cursor-pointer select-none hover:text-gray-200 transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      {label}<SortArrow col={col} sortKey={sortKey} dir={dir} />
    </th>
  );
}

const ALL_SECTORS = ["Todos", ...getSectors()];

export default function AcoesPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState("Todos");
  const [days, setDays] = useState(1);
  const [daysInput, setDaysInput] = useState("1");
  const [maxRows, setMaxRows] = useState(20);
  const [maxInput, setMaxInput] = useState("20");
  const [sortKey, setSortKey] = useState<SortKey>("desconto20d");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    fetch("/api/acoes-board")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleDaysInput(val: string) {
    setDaysInput(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 1 && n <= 30) setDays(n);
  }

  function handleMaxInput(val: string) {
    setMaxInput(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 1) setMaxRows(n);
  }

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(col); setSortDir("asc"); }
  }

  const baseRows = sector === "Todos" ? rows : rows.filter((r) => r.sector === sector);

  const sorted = baseRows.slice().sort((a, b) => {
    let va: number | string, vb: number | string;
    if (sortKey === "symbol") { va = a.symbol; vb = b.symbol; }
    else if (sortKey === "sector") { va = a.sector; vb = b.sector; }
    else if (sortKey === "price") { va = a.price ?? -Infinity; vb = b.price ?? -Infinity; }
    else if (sortKey === "varNd") { va = changePctN(a.closes30, days) ?? -Infinity; vb = changePctN(b.closes30, days) ?? -Infinity; }
    else if (sortKey === "desconto20d") { va = a.desconto20d ?? Infinity; vb = b.desconto20d ?? Infinity; }
    else if (sortKey === "mma20dist") { va = a.mma20dist ?? Infinity; vb = b.mma20dist ?? Infinity; }
    else if (sortKey === "dividendYield12m") { va = a.dividendYield12m; vb = b.dividendYield12m; }
    else { va = MOMENTUM_ORDER[a.momentum]; vb = MOMENTUM_ORDER[b.momentum]; }
    if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const displayed = sorted.slice(0, maxRows);

  // Scoreboard de setores usando janela de dias selecionada
  const sectorMap = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const v = changePctN(r.closes30, days);
    if (v === null) continue;
    const cur = sectorMap.get(r.sector) ?? { sum: 0, count: 0 };
    sectorMap.set(r.sector, { sum: cur.sum + v, count: cur.count + 1 });
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
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-200">Radar de Momentum</h2>
        </div>

        {/* Filtro setor */}
        <div className="flex gap-1 flex-wrap mb-3">
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

        {/* Inputs numéricos */}
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Variação (dias):</span>
            <input
              type="number"
              min={1}
              max={30}
              value={daysInput}
              onChange={(e) => handleDaysInput(e.target.value)}
              onBlur={() => setDaysInput(String(days))}
              className="w-16 bg-gray-800 border border-gray-600 text-white text-sm text-center rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-500">(1–30)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Ativos exibidos:</span>
            <input
              type="number"
              min={1}
              max={rows.length || 50}
              value={maxInput}
              onChange={(e) => handleMaxInput(e.target.value)}
              onBlur={() => setMaxInput(String(maxRows))}
              className="w-16 bg-gray-800 border border-gray-600 text-white text-sm text-center rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-500">de {baseRows.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <Th label="Ativo"      col="symbol"          sortKey={sortKey} dir={sortDir} onSort={handleSort} />
                <Th label="Setor"      col="sector"          sortKey={sortKey} dir={sortDir} onSort={handleSort} />
                <Th label="Preço"      col="price"           sortKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                <Th label={`Var ${days}D`} col="varNd"       sortKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                <Th label="Desc. 20d"  col="desconto20d"     sortKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                <Th label="MM20 dist." col="mma20dist"       sortKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                <Th label="DY 12m"     col="dividendYield12m" sortKey={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
                <Th label="Momentum"   col="momentum"        sortKey={sortKey} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {displayed.map((r) => {
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
                    <td className="py-2 pr-4 text-right text-green-400">{r.dividendYield12m}%</td>
                    <td className="py-2"><MomentumBadge m={r.momentum} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Desc. 20d = % abaixo da máxima dos últimos 20 pregões. Clique nos cabeçalhos para ordenar.
        </p>
      </section>

      {/* 2. Painel de Dividendos */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Painel de Dividendos</h2>
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
        <p className="text-xs text-gray-500 mb-3">Variação média no período selecionado ({days}D). Clique para filtrar a tabela.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sectorBoard.map(({ sector: s, avg }) => (
            <div
              key={s}
              className={`rounded-lg p-3 border cursor-pointer transition-colors ${
                sector === s ? "border-blue-500 bg-blue-900/20" : "border-gray-700 bg-gray-800/50 hover:border-blue-500"
              }`}
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
      </section>

      {/* 4. Ideias de Entrada */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Ideias de Entrada</h2>
        <p className="text-xs text-gray-500 mb-3">Desconto &gt; 5% da máxima dos últimos 20 pregões e momentum não negativo.</p>
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
