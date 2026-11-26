"use client";

import { useEffect, useState } from "react";
import { B3_FIIS, type FiiType } from "@/lib/sources/b3Fiis";

interface FiiRow {
  symbol: string;
  name: string;
  type: FiiType;
  vpa: number;
  payDay: number | null;
  price: number | null;
  pvp: number | null;
  monthlyDY: number;
  desconto20d: number | null;
  mma20dist: number | null;
  closes30: number[];
  signal: "oportunidade" | "descontado" | "neutro" | "caro";
}

interface PortfolioEntry { symbol: string; cotas: number }

const FII_TYPES: FiiType[] = ["Tijolo", "Papel", "Híbrido", "FoF"];
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

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

function pvpColor(v: number | null): string {
  if (v === null) return "text-gray-400";
  if (v < 0.95) return "text-green-400";
  if (v > 1.10) return "text-red-400";
  return "text-gray-200";
}

// Calcula variação de N dias a partir do array closes30 (últimos 31 fechamentos)
function changePctN(closes30: number[], n: number): number | null {
  if (closes30.length < 2) return null;
  const price = closes30[closes30.length - 1];
  const idx = closes30.length - 1 - Math.min(n, closes30.length - 1);
  const base = closes30[idx];
  if (!base) return null;
  return ((price - base) / base) * 100;
}

function SignalBadge({ s }: { s: FiiRow["signal"] }) {
  const cfg = {
    oportunidade: { bg: "bg-green-900/60", text: "text-green-300", label: "oportunidade" },
    descontado:   { bg: "bg-blue-900/60",  text: "text-blue-300",  label: "descontado" },
    neutro:       { bg: "bg-gray-700",     text: "text-gray-400",  label: "neutro" },
    caro:         { bg: "bg-red-900/60",   text: "text-red-300",   label: "caro" },
  }[s];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
}

export default function FiisPage() {
  const [rows, setRows] = useState<FiiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<FiiType | "Todos">("Todos");
  const [days, setDays] = useState(1);
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([]);
  const [editSymbol, setEditSymbol] = useState<string | null>(null);
  const [editCotas, setEditCotas] = useState("");

  useEffect(() => {
    fetch("/api/fiis-board")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fiis_portfolio");
      if (saved) setPortfolio(JSON.parse(saved));
    } catch {}
  }, []);

  function savePortfolio(entries: PortfolioEntry[]) {
    setPortfolio(entries);
    try { localStorage.setItem("fiis_portfolio", JSON.stringify(entries)); } catch {}
  }

  function updateCotas(symbol: string, cotas: number) {
    const existing = portfolio.find((e) => e.symbol === symbol);
    let next: PortfolioEntry[];
    if (cotas === 0) {
      next = portfolio.filter((e) => e.symbol !== symbol);
    } else if (existing) {
      next = portfolio.map((e) => e.symbol === symbol ? { ...e, cotas } : e);
    } else {
      next = [...portfolio, { symbol, cotas }];
    }
    savePortfolio(next);
    setEditSymbol(null);
  }

  const filtered = typeFilter === "Todos" ? rows : rows.filter((r) => r.type === typeFilter);

  const portfolioRows = portfolio
    .map((e) => {
      const row = rows.find((r) => r.symbol === e.symbol);
      const fiiConfig = B3_FIIS.find((f) => f.symbol === e.symbol);
      if (!row || !fiiConfig) return null;
      const rendaMensal = row.price ? (row.price * fiiConfig.monthlyDY / 100) * e.cotas : null;
      return { ...e, row, fiiConfig, rendaMensal };
    })
    .filter(Boolean) as Array<{ symbol: string; cotas: number; row: FiiRow; fiiConfig: typeof B3_FIIS[number]; rendaMensal: number | null }>;

  const totalRenda = portfolioRows.reduce((acc, r) => acc + (r.rendaMensal ?? 0), 0);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-4">FIIs</h1>
        <p className="text-gray-400">Carregando dados...</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold text-white">FIIs</h1>

      {/* 1. Radar P/VP + Desconto */}
      <section>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-200">Radar P/VP + Desconto</h2>

          {/* Filtro por tipo */}
          <div className="flex gap-1 flex-wrap">
            {(["Todos", ...FII_TYPES] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  typeFilter === t
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-600 text-gray-400 hover:border-gray-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Seletor de janela de variação */}
          <div className="flex items-center gap-2 ml-auto">
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
                <th className="pb-2 pr-4">FII</th>
                <th className="pb-2 pr-4">Tipo</th>
                <th className="pb-2 pr-4 text-right">Preço</th>
                <th className="pb-2 pr-4 text-right">Var {days}D</th>
                <th className="pb-2 pr-4 text-right">P/VP</th>
                <th className="pb-2 pr-4 text-right">DY/mês</th>
                <th className="pb-2 pr-4 text-right" title="% abaixo da máxima dos últimos 20 pregões">Desc. 20d</th>
                <th className="pb-2 pr-4 text-right" title="% acima/abaixo da média móvel de 20 dias">MM20 dist.</th>
                <th className="pb-2">Sinal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const varNd = changePctN(r.closes30, days);
                return (
                  <tr key={r.symbol} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 font-mono text-white">{r.symbol}</td>
                    <td className="py-2 pr-4 text-gray-400">{r.type}</td>
                    <td className="py-2 pr-4 text-right text-gray-200">
                      {r.price ? `R$ ${fmt(r.price)}` : "–"}
                    </td>
                    <td className={`py-2 pr-4 text-right font-semibold ${pctColor(varNd)}`}>
                      {varNd !== null ? `${varNd > 0 ? "+" : ""}${fmt(varNd)}%` : "–"}
                    </td>
                    <td className={`py-2 pr-4 text-right font-semibold ${pvpColor(r.pvp)}`}>
                      {fmt(r.pvp)}
                    </td>
                    <td className="py-2 pr-4 text-right text-green-400">{r.monthlyDY}%</td>
                    <td className={`py-2 pr-4 text-right ${r.desconto20d !== null && r.desconto20d < -5 ? "text-green-400" : "text-gray-300"}`}>
                      {r.desconto20d !== null ? `${fmt(r.desconto20d)}%` : "–"}
                    </td>
                    <td className={`py-2 pr-4 text-right ${pctColor(r.mma20dist)}`}>
                      {r.mma20dist !== null ? `${r.mma20dist > 0 ? "+" : ""}${fmt(r.mma20dist)}%` : "–"}
                    </td>
                    <td className="py-2"><SignalBadge s={r.signal} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Desc. 20d = % abaixo da máxima dos últimos 20 pregões. MM20 dist. = % acima/abaixo da média de 20 dias. Sinal &ldquo;oportunidade&rdquo;: P/VP &lt; 0,95 e queda &gt; 5% da máxima recente.
        </p>
      </section>

      {/* 2. Calendário de Proventos */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Calendário de Proventos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MONTHS.map((month, i) => {
            const withDay = B3_FIIS.filter((f) => f.payDay !== undefined).sort((a, b) => (a.payDay ?? 99) - (b.payDay ?? 99));
            return (
              <div key={i} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs font-semibold text-gray-300 mb-2">{month}</div>
                <div className="space-y-1">
                  {withDay.slice(0, 6).map((f) => (
                    <div key={f.symbol} className="flex justify-between text-xs">
                      <span className="font-mono text-white">{f.symbol}</span>
                      <span className="text-gray-400">dia {f.payDay}</span>
                    </div>
                  ))}
                  {withDay.length > 6 && <div className="text-xs text-gray-500">+{withDay.length - 6} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Portfólio */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-1">Meu Portfólio</h2>
        <p className="text-xs text-gray-500 mb-3">Cotas salvas no seu navegador. Clique em qualquer FII para adicionar/editar cotas.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {B3_FIIS.map((fii) => {
            const entry = portfolio.find((e) => e.symbol === fii.symbol);
            const row = rows.find((r) => r.symbol === fii.symbol);
            const isEditing = editSymbol === fii.symbol;
            return (
              <div key={fii.symbol} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-mono font-bold text-white text-sm">{fii.symbol}</span>
                  <span className="text-xs text-gray-500">{fii.type}</span>
                </div>
                {isEditing ? (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      min={0}
                      value={editCotas}
                      onChange={(e) => setEditCotas(e.target.value)}
                      className="flex-1 bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600"
                      placeholder="cotas (0 = remover)"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") updateCotas(fii.symbol, Number(editCotas)); if (e.key === "Escape") setEditSymbol(null); }}
                    />
                    <button onClick={() => updateCotas(fii.symbol, Number(editCotas))} className="bg-blue-700 text-white text-xs px-3 py-1 rounded">OK</button>
                    <button onClick={() => setEditSymbol(null)} className="text-gray-400 text-xs px-2">✕</button>
                  </div>
                ) : (
                  <div
                    className="flex justify-between items-center mt-2 cursor-pointer group"
                    onClick={() => { setEditSymbol(fii.symbol); setEditCotas(String(entry?.cotas ?? "")); }}
                  >
                    <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
                      {entry ? `${entry.cotas} cotas` : "— clique p/ adicionar"}
                    </span>
                    {entry && row?.price && (
                      <span className="text-xs text-green-400">
                        R$ {((row.price * fii.monthlyDY / 100) * entry.cotas).toFixed(2)}/mês
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {portfolioRows.length > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-300 mb-1">Renda mensal estimada (total)</div>
            <div className="text-2xl font-bold text-green-400">R$ {totalRenda.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">baseado no DY mensal estimado × preço atual × cotas</div>
          </div>
        )}
      </section>

      {/* 4. Comparador por Tipo */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Comparador por Tipo</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {FII_TYPES.map((type) => {
            const subset = rows.filter((r) => r.type === type);
            const withPvp = subset.filter((r) => r.pvp !== null);
            const avgPvp = withPvp.length ? withPvp.reduce((a, r) => a + r.pvp!, 0) / withPvp.length : null;
            const avgDY = B3_FIIS.filter((f) => f.type === type).reduce((a, f) => a + f.monthlyDY, 0) / (B3_FIIS.filter((f) => f.type === type).length || 1);
            const withVar = subset.filter((r) => r.closes30.length >= 2);
            const avg1d = withVar.length
              ? withVar.reduce((a, r) => a + (changePctN(r.closes30, 1) ?? 0), 0) / withVar.length
              : null;
            const oportunidades = subset.filter((r) => r.signal === "oportunidade" || r.signal === "descontado").length;
            return (
              <div key={type} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="font-semibold text-gray-200 mb-3">{type}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">P/VP médio</span>
                    <span className={`font-semibold ${pvpColor(avgPvp)}`}>{avgPvp !== null ? avgPvp.toFixed(2) : "–"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">DY/mês médio</span>
                    <span className="text-green-400">{avgDY.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Var. 1D média</span>
                    <span className={pctColor(avg1d)}>{avg1d !== null ? `${avg1d > 0 ? "+" : ""}${avg1d.toFixed(2)}%` : "–"}</span>
                  </div>
                  {oportunidades > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Oport./descontados</span>
                      <span className="text-green-400">{oportunidades}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 pt-1">{subset.length} FIIs rastreados</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
