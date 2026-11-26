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

interface SimResult {
  fvResult: number | null;
  pmtResult: number | null;
  nResult: number | null;
  totalInvested: number;
  juros: number;
  months: number;
}

type SimMode = "quanto-recebo" | "quanto-aportar" | "em-quanto-tempo";

const TYPE_COLORS: Record<Bond["type"], string> = {
  "Prefixado": "bg-blue-900/60 text-blue-300",
  "IPCA+":     "bg-purple-900/60 text-purple-300",
  "Selic":     "bg-yellow-900/60 text-yellow-300",
  "Outro":     "bg-gray-700 text-gray-400",
};

function monthlyRate(annualPct: number) {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

function calcFV(pv: number, pmt: number, annualPct: number, months: number): number {
  const r = monthlyRate(annualPct);
  if (r === 0) return pv + pmt * months;
  return pv * Math.pow(1 + r, months) + pmt * ((Math.pow(1 + r, months) - 1) / r);
}

function calcPMT(pv: number, fv: number, annualPct: number, months: number): number {
  const r = monthlyRate(annualPct);
  if (r === 0) return (fv - pv) / Math.max(months, 1);
  const factor = (Math.pow(1 + r, months) - 1) / r;
  return (fv - pv * Math.pow(1 + r, months)) / factor;
}

function calcMonths(pv: number, pmt: number, fv: number, annualPct: number): number | null {
  const r = monthlyRate(annualPct);
  if (pmt <= 0 && pv <= 0) return null;
  if (r === 0) return pmt > 0 ? Math.ceil((fv - pv) / pmt) : null;
  let lo = 1, hi = 600;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (calcFV(pv, pmt, annualPct, mid) < fv) lo = mid; else hi = mid;
  }
  return Math.ceil(hi);
}

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return n.toFixed(2) + "%";
}

function maturityLabel(iso: string): string {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx] ?? m}/${y}`;
}

function yearsUntil(maturity: string): number {
  const now = new Date();
  const end = new Date(maturity);
  return Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

export default function RendaFixaPage() {
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState("");
  const [typeFilter, setTypeFilter] = useState<Bond["type"] | "Todos">("Todos");

  const [selectedBond, setSelectedBond] = useState<Bond | null>(null);
  const [mode, setMode] = useState<SimMode>("quanto-aportar");
  const [pvInput, setPvInput] = useState("0");
  const [pmtInput, setPmtInput] = useState("1000");
  const [fvInput, setFvInput] = useState("1000000");
  const [inflacaoInput, setInflacaoInput] = useState("4.5");
  const [customRate, setCustomRate] = useState("");
  const [customMonths, setCustomMonths] = useState("60");

  const effectiveRate = useMemo((): number => {
    if (selectedBond) {
      if (selectedBond.type === "IPCA+") {
        const spread = selectedBond.annualRate / 100;
        const infl = parseFloat(inflacaoInput.replace(",", ".")) / 100 || 0.045;
        return ((1 + spread) * (1 + infl) - 1) * 100;
      }
      return selectedBond.annualRate;
    }
    const n = parseFloat(customRate.replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [selectedBond, customRate, inflacaoInput]);

  const maturityMonths = useMemo((): number => {
    if (selectedBond) {
      return Math.max(1, Math.round(yearsUntil(selectedBond.maturity) * 12));
    }
    const n = parseInt(customMonths, 10);
    return isNaN(n) || n < 1 ? 60 : n;
  }, [selectedBond, customMonths]);

  const pv  = parseFloat(pvInput.replace(/\./g, "").replace(",", ".")) || 0;
  const pmt = parseFloat(pmtInput.replace(/\./g, "").replace(",", ".")) || 0;
  const fv  = parseFloat(fvInput.replace(/\./g, "").replace(",", ".")) || 0;

  const sim = useMemo((): SimResult | null => {
    if (effectiveRate <= 0) return null;
    const n = maturityMonths;

    if (mode === "quanto-recebo") {
      const fvResult = calcFV(pv, pmt, effectiveRate, n);
      const totalInvested = pv + pmt * n;
      return { fvResult, pmtResult: null, nResult: null, totalInvested, juros: fvResult - totalInvested, months: n };
    }
    if (mode === "quanto-aportar") {
      const pmtResult = calcPMT(pv, fv, effectiveRate, n);
      const totalInvested = pv + Math.max(0, pmtResult) * n;
      return { fvResult: fv, pmtResult, nResult: null, totalInvested, juros: fv - totalInvested, months: n };
    }
    // em quanto tempo
    const nResult = calcMonths(pv, pmt, fv, effectiveRate);
    if (nResult === null) return null;
    const fvResult = calcFV(pv, pmt, effectiveRate, nResult);
    const totalInvested = pv + pmt * nResult;
    return { fvResult, pmtResult: null, nResult, totalInvested, juros: fvResult - totalInvested, months: nResult };
  }, [mode, pv, pmt, fv, effectiveRate, maturityMonths]);

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

  const types = [...new Set(bonds.map((b) => b.type))].sort() as Bond["type"][];
  const filtered = typeFilter === "Todos" ? bonds : bonds.filter((b) => b.type === typeFilter);

  function selectBond(b: Bond) {
    setSelectedBond((s) => s?.name === b.name ? null : b);
    setCustomRate("");
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-white">Renda Fixa — Tesouro Direto</h1>
        {fetchedAt && (
          <span className="text-xs text-gray-500">
            Atualizado: {new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Tabela de títulos ao vivo */}
      <section>
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-200">Taxas ao vivo</h2>
          <div className="flex gap-1 flex-wrap">
            {(["Todos", ...types] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t as typeof typeFilter)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  typeFilter === t ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-400 hover:border-gray-400"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="text-gray-400 text-sm">Buscando taxas...</p>}
        {fetchError && <p className="text-red-400 text-sm mb-2">Erro ao buscar taxas: {fetchError}. Use a taxa manual no simulador abaixo.</p>}
        {!loading && bonds.length === 0 && !fetchError && (
          <p className="text-gray-400 text-sm">Nenhum título disponível agora (mercado fechado). Use a taxa manual no simulador.</p>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 pr-4">Título</th>
                  <th className="pb-2 pr-4">Tipo</th>
                  <th className="pb-2 pr-4">Vencimento</th>
                  <th className="pb-2 pr-4 text-right">Taxa a.a.</th>
                  <th className="pb-2 pr-4 text-right">Preço unit.</th>
                  <th className="pb-2 pr-4 text-right">Mín. R$</th>
                  <th className="pb-2 text-center">Simular</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.name}
                    className={`border-b border-gray-800 hover:bg-gray-800/30 cursor-pointer ${selectedBond?.name === b.name ? "bg-blue-900/20" : ""}`}
                    onClick={() => selectBond(b)}>
                    <td className="py-2 pr-4 text-gray-200">{b.name}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[b.type]}`}>{b.type}</span>
                    </td>
                    <td className="py-2 pr-4 text-gray-400">{maturityLabel(b.maturity)}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-green-400">{fmtPct(b.annualRate)}</td>
                    <td className="py-2 pr-4 text-right text-gray-300">R$ {b.unitPrice.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right text-gray-400">R$ {b.minAmount.toFixed(2)}</td>
                    <td className="py-2 text-center">
                      <button onClick={(e) => { e.stopPropagation(); selectBond(b); }}
                        className={`text-xs px-3 py-1 rounded border transition-colors ${
                          selectedBond?.name === b.name
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-gray-600 text-gray-400 hover:border-blue-500"
                        }`}>
                        {selectedBond?.name === b.name ? "✓ selecionado" : "selecionar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Simulador */}
      <section className="bg-gray-800/40 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Simulador</h2>

        {/* Título selecionado ou taxa manual */}
        {selectedBond ? (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg text-sm flex flex-wrap gap-3 items-center">
            <span className="text-blue-300 font-medium">{selectedBond.name}</span>
            <span className="text-gray-400">venc. {maturityLabel(selectedBond.maturity)} · {maturityMonths} meses</span>
            {selectedBond.type === "IPCA+" && (
              <span className="text-purple-300">spread {fmtPct(selectedBond.annualRate)} + IPCA</span>
            )}
            <button onClick={() => setSelectedBond(null)} className="text-gray-500 hover:text-gray-300 text-xs ml-auto">✕ limpar</button>
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Taxa manual (% a.a.):</span>
              <input type="text" value={customRate} onChange={(e) => setCustomRate(e.target.value)}
                placeholder="ex: 15.32"
                className="w-24 bg-gray-700 border border-gray-600 text-white text-sm text-center rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Prazo (meses):</span>
              <input type="number" value={customMonths} onChange={(e) => setCustomMonths(e.target.value)} min={1} max={600}
                className="w-20 bg-gray-700 border border-gray-600 text-white text-sm text-center rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
        )}

        {/* IPCA assumption */}
        {selectedBond?.type === "IPCA+" && (
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs text-gray-400">Inflação anual assumida (IPCA):</span>
            <input type="text" value={inflacaoInput} onChange={(e) => setInflacaoInput(e.target.value)}
              className="w-20 bg-gray-700 border border-gray-600 text-white text-sm text-center rounded px-2 py-1 focus:outline-none focus:border-purple-500" />
            <span className="text-xs text-gray-400">% a.a.</span>
            <span className="text-xs text-gray-500">Taxa nominal: <span className="text-purple-300 font-medium">{fmtPct(effectiveRate)}</span></span>
          </div>
        )}

        {/* Modo */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {([
            { key: "quanto-recebo" as SimMode,     label: "Quanto terei?" },
            { key: "quanto-aportar" as SimMode,    label: "Quanto preciso aportar/mês?" },
            { key: "em-quanto-tempo" as SimMode,   label: "Em quanto tempo?" },
          ]).map((m) => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
                mode === m.key ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-400 hover:border-gray-400"
              }`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">Aporte inicial (R$)</span>
            <input type="text" value={pvInput} onChange={(e) => setPvInput(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500" />
          </label>
          {mode !== "quanto-aportar" && (
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Aporte mensal (R$)</span>
              <input type="text" value={pmtInput} onChange={(e) => setPmtInput(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500" />
            </label>
          )}
          {mode !== "quanto-recebo" && (
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Objetivo (R$)</span>
              <input type="text" value={fvInput} onChange={(e) => setFvInput(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500" />
            </label>
          )}
        </div>

        {/* Resultado */}
        {effectiveRate > 0 && sim !== null ? (
          <div className="bg-gray-900/60 rounded-lg border border-gray-600 p-5">
            <div className="text-xs text-gray-400 mb-3">
              Taxa efetiva: <span className="text-green-400 font-semibold">{fmtPct(effectiveRate)} a.a.</span>
              {selectedBond && <span className="ml-3 text-gray-500">· venc. {maturityLabel(selectedBond.maturity)} ({maturityMonths} meses)</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {mode === "quanto-recebo" && sim.fvResult !== null && (
                <div>
                  <div className="text-xs text-gray-400">Patrimônio final</div>
                  <div className="text-2xl font-bold text-green-400">{fmtBRL(sim.fvResult)}</div>
                </div>
              )}
              {mode === "quanto-aportar" && sim.pmtResult !== null && (
                <div>
                  <div className="text-xs text-gray-400">Aporte mensal necessário</div>
                  <div className="text-2xl font-bold text-green-400">{fmtBRL(Math.max(0, sim.pmtResult))}</div>
                </div>
              )}
              {mode === "em-quanto-tempo" && sim.nResult !== null && (
                <div>
                  <div className="text-xs text-gray-400">Tempo para atingir objetivo</div>
                  <div className="text-2xl font-bold text-green-400">
                    {sim.nResult} meses
                    <span className="text-base font-normal text-gray-400 ml-2">({(sim.nResult / 12).toFixed(1)} anos)</span>
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-400">Total investido</div>
                <div className="text-lg font-semibold text-gray-200">{fmtBRL(sim.totalInvested)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Juros ganhos</div>
                <div className="text-lg font-semibold text-blue-400">{fmtBRL(sim.juros)}</div>
              </div>
            </div>

            {/* Progressão anual */}
            <div className="overflow-x-auto">
              <div className="text-xs text-gray-400 mb-2">Progressão anual</div>
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-700">
                    <th className="pb-1 pr-3 text-left">Ano</th>
                    <th className="pb-1 pr-3 text-right">Meses</th>
                    <th className="pb-1 pr-3 text-right">Patrimônio</th>
                    <th className="pb-1 pr-3 text-right">Investido</th>
                    <th className="pb-1 text-right">Juros</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.min(15, Math.ceil(sim.months / 12)) }, (_, i) => {
                    const m = (i + 1) * 12;
                    const usePmt = mode === "quanto-aportar" && sim.pmtResult !== null ? Math.max(0, sim.pmtResult) : pmt;
                    const fvAt = calcFV(pv, usePmt, effectiveRate, m);
                    const invested = pv + usePmt * m;
                    return (
                      <tr key={i} className="border-b border-gray-800">
                        <td className="py-1 pr-3 text-gray-400">{new Date().getFullYear() + i + 1}</td>
                        <td className="py-1 pr-3 text-right text-gray-400">{m}</td>
                        <td className="py-1 pr-3 text-right text-green-400 font-medium">{fmtBRL(fvAt)}</td>
                        <td className="py-1 pr-3 text-right text-gray-400">{fmtBRL(invested)}</td>
                        <td className="py-1 text-right text-blue-400">{fmtBRL(fvAt - invested)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">
            {effectiveRate <= 0
              ? "Selecione um título na tabela acima ou insira a taxa manualmente para simular."
              : "Ajuste os parâmetros para ver o resultado."}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-600">
        Simulação com reinvestimento de cupons (juros compostos mensais). Para IPCA+, taxa nominal = (1 + spread) × (1 + inflação) − 1. Rentabilidade passada não garante retorno futuro.
      </p>
    </main>
  );
}
