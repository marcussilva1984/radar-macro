"use client";

// Nota: a seção de Portfólio usa localStorage — precisa de Client Component.
// As outras seções consomem dados via Server Component wrapper (ver FiisServer abaixo).
// Pra manter simples num único arquivo, todo o componente é client-side.

import { useEffect, useState } from "react";
import { B3_FIIS, type FiiType } from "@/lib/sources/b3Fiis";

interface FiiRow {
  symbol: string;
  name: string;
  type: FiiType;
  price: number | null;
  changePct: number | null;
  pvp: number | null;
  monthlyDY: number;
  rsiDaily: number | null;
  rsiWeekly: number | null;
  signal: "compra" | "neutro" | "caro";
  vpa: number;
  payDay?: number;
}

interface PortfolioEntry {
  symbol: string;
  cotas: number;
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

function rsiColor(rsi: number | null): string {
  if (rsi === null) return "text-gray-400";
  if (rsi > 70) return "text-red-400";
  if (rsi < 30) return "text-green-400";
  return "text-blue-400";
}

function SignalBadge({ s }: { s: FiiRow["signal"] }) {
  const cls =
    s === "compra"
      ? "bg-green-900/60 text-green-300"
      : s === "caro"
      ? "bg-red-900/60 text-red-300"
      : "bg-gray-700 text-gray-400";
  const label = s === "compra" ? "P/VP atrativo" : s === "caro" ? "caro" : "neutro";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const FII_TYPES: FiiType[] = ["Tijolo", "Papel", "Híbrido", "FoF"];

export default function FiisPage() {
  const [rows, setRows] = useState<FiiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([]);
  const [editSymbol, setEditSymbol] = useState<string | null>(null);
  const [editCotas, setEditCotas] = useState("");

  // Carrega dados do servidor via API route
  useEffect(() => {
    fetch("/api/fiis-board")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Portfólio em localStorage
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

  // Cálculo de renda mensal do portfólio
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

      {/* 1. Radar P/VP + DY */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Radar P/VP + DY</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">FII</th>
                <th className="pb-2 pr-4">Tipo</th>
                <th className="pb-2 pr-4 text-right">Preço</th>
                <th className="pb-2 pr-4 text-right">1D %</th>
                <th className="pb-2 pr-4 text-right">P/VP</th>
                <th className="pb-2 pr-4 text-right">DY/mês</th>
                <th className="pb-2 pr-4 text-right">RSI D</th>
                <th className="pb-2">Sinal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 font-mono text-white">{r.symbol}</td>
                  <td className="py-2 pr-4 text-gray-400">{r.type}</td>
                  <td className="py-2 pr-4 text-right text-gray-200">
                    {r.price ? `R$ ${fmt(r.price)}` : "–"}
                  </td>
                  <td className={`py-2 pr-4 text-right ${pctColor(r.changePct)}`}>
                    {r.changePct !== null ? `${r.changePct > 0 ? "+" : ""}${fmt(r.changePct)}%` : "–"}
                  </td>
                  <td className={`py-2 pr-4 text-right font-semibold ${r.pvp !== null && r.pvp < 0.95 ? "text-green-400" : r.pvp !== null && r.pvp > 1.10 ? "text-red-400" : "text-gray-200"}`}>
                    {fmt(r.pvp)}
                  </td>
                  <td className="py-2 pr-4 text-right text-green-400">{r.monthlyDY}%</td>
                  <td className={`py-2 pr-4 text-right ${rsiColor(r.rsiDaily)}`}>{fmt(r.rsiDaily, 1)}</td>
                  <td className="py-2"><SignalBadge s={r.signal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Calendário de Proventos */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Calendário de Proventos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const fiis = B3_FIIS.filter((f) => f.payDay !== undefined && f.payDay !== undefined)
              .filter(() => true) // todos pagam todo mês
              .sort((a, b) => (a.payDay ?? 99) - (b.payDay ?? 99));
            // mostra os que têm payDay definido
            const withDay = fiis.filter((f) => f.payDay !== undefined);
            if (withDay.length === 0 && month !== 1) return null;
            return (
              <div key={month} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs font-semibold text-gray-300 mb-2">{MONTHS[month - 1]}</div>
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

      {/* 3. Portfólio — Renda Mensal */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-1">Meu Portfólio</h2>
        <p className="text-xs text-gray-500 mb-3">Cotas salvas no seu navegador. Clique em qualquer FII para adicionar/editar.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
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
                      placeholder="cotas"
                      autoFocus
                    />
                    <button onClick={() => updateCotas(fii.symbol, Number(editCotas))} className="bg-blue-700 text-white text-xs px-3 py-1 rounded">OK</button>
                    <button onClick={() => setEditSymbol(null)} className="text-gray-400 text-xs px-2">✕</button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center mt-2 cursor-pointer" onClick={() => { setEditSymbol(fii.symbol); setEditCotas(String(entry?.cotas ?? "")); }}>
                    <span className="text-xs text-gray-400">{entry ? `${entry.cotas} cotas` : "— clique p/ adicionar"}</span>
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
            const avgPvp = subset.length && subset.some((r) => r.pvp !== null)
              ? subset.filter((r) => r.pvp !== null).reduce((a, r) => a + r.pvp!, 0) / subset.filter((r) => r.pvp !== null).length
              : null;
            const avgDY = B3_FIIS.filter((f) => f.type === type).reduce((a, f) => a + f.monthlyDY, 0) / (B3_FIIS.filter((f) => f.type === type).length || 1);
            const avgChange = subset.filter((r) => r.changePct !== null).length
              ? subset.filter((r) => r.changePct !== null).reduce((a, r) => a + r.changePct!, 0) / subset.filter((r) => r.changePct !== null).length
              : null;
            return (
              <div key={type} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="font-semibold text-gray-200 mb-3">{type}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">P/VP médio</span>
                    <span className={`font-semibold ${avgPvp !== null && avgPvp < 0.95 ? "text-green-400" : avgPvp !== null && avgPvp > 1.10 ? "text-red-400" : "text-gray-200"}`}>
                      {avgPvp !== null ? avgPvp.toFixed(2) : "–"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">DY/mês médio</span>
                    <span className="text-green-400">{avgDY.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Var. 1D média</span>
                    <span className={pctColor(avgChange)}>{avgChange !== null ? `${avgChange > 0 ? "+" : ""}${avgChange.toFixed(2)}%` : "–"}</span>
                  </div>
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
