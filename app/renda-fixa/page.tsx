"use client";

import { useEffect, useState, useMemo } from "react";

interface Bond {
  name: string;
  type: "Prefixado" | "IPCA+" | "Selic" | "Outro";
  maturity: string;
  annualRate: number;
  minAmount: number;
  unitPrice: number;
  updatedAt: string;
}

function monthlyRate(annualPct: number) {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

function calcFV(pv: number, pmt: number, annualPct: number, months: number): number {
  const r = monthlyRate(annualPct);
  if (r === 0) return pv + pmt * months;
  return pv * Math.pow(1 + r, months) + pmt * ((Math.pow(1 + r, months) - 1) / r);
}

function monthsUntil(maturity: string): number {
  const now = new Date();
  const end = new Date(maturity);
  const diff = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(1, diff);
}

function maturityLabel(iso: string): string {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(m, 10) - 1]}/${y}`;
}

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return n.toFixed(2) + "% a.a.";
}

interface CardData {
  bond: Bond;
  months: number;
  fv: number;
  totalInvested: number;
  juros: number;
  jurosRatio: number;
  yearRows: { year: number; fvAt: number; invested: number; jurosAt: number }[];
}

type ClassKey = "forex" | "acoes" | "fiis" | "crypto" | "prefixado";

const CLASS_LABELS: Record<ClassKey, string> = {
  forex:     "Forex",
  acoes:     "Ações B3",
  fiis:      "FIIs",
  crypto:    "Cripto",
  prefixado: "Prefixado",
};

const CLASS_COLORS: Record<ClassKey, string> = {
  forex:     "bg-yellow-500",
  acoes:     "bg-green-500",
  fiis:      "bg-purple-500",
  crypto:    "bg-orange-500",
  prefixado: "bg-blue-500",
};

const CLASS_ORDER: ClassKey[] = ["forex", "acoes", "fiis", "crypto", "prefixado"];

type Allocs = Record<ClassKey, number>;

export default function RendaFixaPage() {
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState("");

  const [pv, setPv] = useState(0);
  const [pvInput, setPvInput] = useState("0");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Planejador
  const [totalInput, setTotalInput] = useState("1500");
  const [allocs, setAllocs] = useState<Allocs>({ forex: 20, acoes: 20, fiis: 20, crypto: 20, prefixado: 20 });
  const [useAllocator, setUseAllocator] = useState(false);
  const [pmtInput, setPmtInput] = useState("300");

  const totalMonthly = parseFloat(totalInput.replace(/\./g, "").replace(",", ".")) || 0;
  const allocSum = Object.values(allocs).reduce((a, b) => a + b, 0);

  const pmtFromAlloc = Math.round((allocs.prefixado / 100) * totalMonthly);
  const pmt = useAllocator ? pmtFromAlloc : (parseFloat(pmtInput.replace(/\./g, "").replace(",", ".")) || 0);

  useEffect(() => {
    fetch("/api/tesouro-rates")
      .then((r) => r.json())
      .then((d: { bonds?: Bond[]; fetchedAt?: string; error?: string }) => {
        setBonds(d.bonds ?? []);
        setFetchedAt(d.fetchedAt ?? "");
        setLoading(false);
        if (d.error) setFetchError(d.error);
      })
      .catch((e: Error) => { setFetchError(e.message); setLoading(false); });
  }, []);

  const prefixados = useMemo(
    () => bonds.filter((b) => b.type === "Prefixado").sort((a, b) => a.maturity.localeCompare(b.maturity)),
    [bonds]
  );

  const cards = useMemo((): CardData[] => {
    return prefixados.map((bond) => {
      const months = monthsUntil(bond.maturity);
      const fv = calcFV(pv, pmt, bond.annualRate, months);
      const totalInvested = pv + pmt * months;
      const juros = fv - totalInvested;
      const jurosRatio = totalInvested > 0 ? juros / totalInvested : 0;
      const totalYears = Math.ceil(months / 12);
      const yearRows = Array.from({ length: totalYears }, (_, i) => {
        const m = Math.min((i + 1) * 12, months);
        const fvAt = calcFV(pv, pmt, bond.annualRate, m);
        const invested = pv + pmt * m;
        return { year: new Date().getFullYear() + i + 1, fvAt, invested, jurosAt: fvAt - invested };
      });
      return { bond, months, fv, totalInvested, juros, jurosRatio, yearRows };
    });
  }, [prefixados, pv, pmt]);

  function setAlloc(key: ClassKey, val: number) {
    setAllocs((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, val)) }));
  }

  function normalize() {
    if (allocSum === 0) return;
    const factor = 100 / allocSum;
    const next = {} as Allocs;
    (CLASS_ORDER).forEach((k) => { next[k] = Math.round(allocs[k] * factor); });
    // Fix rounding so it sums to exactly 100
    const diff = 100 - Object.values(next).reduce((a, b) => a + b, 0);
    next.prefixado += diff;
    setAllocs(next);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Tesouro Prefixado</h1>
          <p className="text-sm text-gray-400 mt-1">Compare vencimentos e planeje seus aportes mensais</p>
        </div>
        {fetchedAt && (
          <span className="text-xs text-gray-500">
            Atualizado {new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Toggle modo */}
      <div className="flex gap-2">
        <button onClick={() => setUseAllocator(false)}
          className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
            !useAllocator ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-400 hover:border-gray-400"
          }`}>
          Aporte direto no Prefixado
        </button>
        <button onClick={() => setUseAllocator(true)}
          className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
            useAllocator ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-400 hover:border-gray-400"
          }`}>
          Planejar por carteira completa
        </button>
      </div>

      {/* Modo simples */}
      {!useAllocator && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Aporte inicial (R$)</label>
            <input type="text" value={pvInput}
              onChange={(e) => { setPvInput(e.target.value); const n = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")); if (!isNaN(n)) setPv(n); }}
              className="w-32 bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Aporte mensal no Prefixado (R$)</label>
            <input type="text" value={pmtInput}
              onChange={(e) => setPmtInput(e.target.value)}
              className="w-36 bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500" />
            <div className="flex gap-1 mt-2">
              {[200, 300, 400, 500].map((v) => (
                <button key={v} onClick={() => setPmtInput(String(v))}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    pmt === v ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300"
                  }`}>{v}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modo carteira completa */}
      {useAllocator && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Total mensal disponível (R$)</label>
              <input type="text" value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                className="w-36 bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500" />
              <div className="flex gap-1 mt-2">
                {[1000, 1500, 2000, 3000].map((v) => (
                  <button key={v} onClick={() => setTotalInput(String(v))}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      totalMonthly === v ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300"
                    }`}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Aporte inicial (R$)</label>
              <input type="text" value={pvInput}
                onChange={(e) => { setPvInput(e.target.value); const n = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")); if (!isNaN(n)) setPv(n); }}
                className="w-32 bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Sliders de alocação */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">Distribuição mensal</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${allocSum === 100 ? "text-green-400" : "text-yellow-400"}`}>
                  {allocSum}% alocado
                </span>
                {allocSum !== 100 && (
                  <button onClick={normalize}
                    className="text-xs px-2 py-0.5 rounded border border-yellow-700 text-yellow-400 hover:bg-yellow-900/30">
                    normalizar pra 100%
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {CLASS_ORDER.map((key) => {
                const amount = Math.round((allocs[key] / 100) * totalMonthly);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-gray-400 flex-shrink-0">{CLASS_LABELS[key]}</div>
                    <input type="range" min={0} max={100} value={allocs[key]}
                      onChange={(e) => setAlloc(key, parseInt(e.target.value, 10))}
                      className="flex-1 h-1.5 rounded accent-blue-500" />
                    <div className="w-8 text-xs text-center text-gray-300 flex-shrink-0">{allocs[key]}%</div>
                    <div className={`w-24 text-xs text-right flex-shrink-0 font-medium ${key === "prefixado" ? "text-blue-400" : "text-gray-400"}`}>
                      {fmtBRL(amount)}/mês
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barra visual */}
            {allocSum > 0 && (
              <div className="mt-4">
                <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
                  {CLASS_ORDER.map((key) => {
                    const w = (allocs[key] / allocSum) * 100;
                    if (w <= 0) return null;
                    return (
                      <div key={key} className={`${CLASS_COLORS[key]} h-full`} style={{ width: `${w}%` }} />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {CLASS_ORDER.map((key) => allocs[key] > 0 && (
                    <span key={key} className="text-xs text-gray-500 flex items-center gap-1">
                      <span className={`inline-block w-2 h-2 rounded-sm ${CLASS_COLORS[key]}`} />
                      {CLASS_LABELS[key]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Destaque do valor do Prefixado */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 flex items-center gap-3">
            <div className="text-blue-400 text-lg">→</div>
            <div>
              <div className="text-xs text-gray-400">Aporte mensal no Prefixado</div>
              <div className="text-xl font-bold text-blue-400">{fmtBRL(pmtFromAlloc)}/mês</div>
            </div>
            <div className="ml-auto text-xs text-gray-500">
              {totalMonthly > 0 ? `${allocs.prefixado}% de ${fmtBRL(totalMonthly)}` : ""}
            </div>
          </div>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Buscando taxas ao vivo...</p>}
      {fetchError && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 text-sm text-yellow-300">
          Não foi possível buscar taxas: {fetchError}. Tente recarregar.
        </div>
      )}
      {!loading && prefixados.length === 0 && !fetchError && (
        <p className="text-gray-400 text-sm">Nenhum Prefixado disponível agora (mercado fechado). Volte em horário comercial.</p>
      )}

      {/* Cards por vencimento */}
      {cards.length > 0 && pmt > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-300">
            Simulação com <span className="text-blue-400">{fmtBRL(pmt)}/mês</span> por vencimento
          </h2>
          {cards.map((c) => {
            const isOpen = expanded === c.bond.name;
            const barWidth = Math.min(100, Math.round(c.jurosRatio * 100));
            return (
              <div key={c.bond.name} className="bg-gray-800/40 border border-gray-700 rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : c.bond.name)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Tesouro Prefixado</div>
                      <div className="text-lg font-bold text-white">
                        Venc. {maturityLabel(c.bond.maturity)}
                        <span className="ml-2 text-sm font-normal text-gray-400">
                          ({Math.round(c.months / 12 * 10) / 10} anos · {c.months} meses)
                        </span>
                      </div>
                      <div className="text-sm text-blue-400 font-semibold mt-0.5">{fmtPct(c.bond.annualRate)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-0.5">Patrimônio final</div>
                      <div className="text-2xl font-bold text-green-400">{fmtBRL(c.fv)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {fmtBRL(c.totalInvested)} investido · <span className="text-blue-400">{fmtBRL(c.juros)} de juros</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Proporção aportado vs. juros</span>
                      <span className="text-blue-400">+{(c.jurosRatio * 100).toFixed(0)}% de rendimento extra</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
                      <div className="bg-gray-500 h-full" style={{ width: `${100 - barWidth}%` }} />
                      <div className="bg-blue-500 h-full" style={{ width: `${barWidth}%` }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-gray-500">
                      <span>■ Aportado: {fmtBRL(c.totalInvested)}</span>
                      <span className="text-blue-400">■ Juros: {fmtBRL(c.juros)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 mt-2">{isOpen ? "▲ fechar" : "▼ ver ano a ano"}</div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-700 px-5 pb-5 pt-4">
                    <p className="text-xs text-gray-400 mb-3">Evolução do patrimônio a cada ano</p>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-700">
                            <th className="pb-1 pr-4 text-left">Ano</th>
                            <th className="pb-1 pr-4 text-right">Patrimônio</th>
                            <th className="pb-1 pr-4 text-right">Aportado</th>
                            <th className="pb-1 text-right">Juros ganhos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.yearRows.map((row, i) => (
                            <tr key={i} className="border-b border-gray-800/50">
                              <td className="py-1.5 pr-4 text-gray-400">{row.year}</td>
                              <td className="py-1.5 pr-4 text-right text-green-400 font-medium">{fmtBRL(row.fvAt)}</td>
                              <td className="py-1.5 pr-4 text-right text-gray-400">{fmtBRL(row.invested)}</td>
                              <td className="py-1.5 text-right text-blue-400">{fmtBRL(row.jurosAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-600">
        Simulação com juros compostos mensais. Não considera IR (22,5% a 15% regressivo) nem taxa de custódia (0,2% a.a.).
      </p>
    </main>
  );
}
