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

// Simulação de juros compostos com aportes mensais.
// FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
function calcFV(pv: number, pmt: number, annualRate: number, months: number): number {
  const r = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  if (r === 0) return pv + pmt * months;
  return pv * Math.pow(1 + r, months) + pmt * ((Math.pow(1 + r, months) - 1) / r);
}

// Aporte mensal necessário para atingir FV partindo de PV em n meses.
function calcPMT(pv: number, fv: number, annualRate: number, months: number): number {
  const r = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  if (r === 0) return (fv - pv) / months;
  const factor = (Math.pow(1 + r, months) - 1) / r;
  return (fv - pv * Math.pow(1 + r, months)) / factor;
}

// Meses para atingir FV dado PMT e PV.
function calcMonths(pv: number, pmt: number, fv: number, annualRate: number): number | null {
  const r = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  if (r === 0) {
    if (pmt === 0) return null;
    return Math.ceil((fv - pv) / pmt);
  }
  // FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
  // Resolve numericamente por bissecção
  let lo = 1, hi = 600;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (calcFV(pv, pmt, annualRate, mid) < fv) lo = mid; else hi = mid;
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
  return `${months[parseInt(m) - 1]}/${y}`;
}

function yearsUntil(maturity: string): number {
  const now = new Date();
  const end = new Date(maturity);
  return Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

type SimMode = "quanto-aportar" | "quanto-recebo" | "em-quanto-tempo";

const TYPE_COLORS: Record<Bond["type"], string> = {
  "Prefixado": "bg-blue-900/60 text-blue-300",
  "IPCA+":     "bg-purple-900/60 text-purple-300",
  "Selic":     "bg-yellow-900/60 text-yellow-300",
  "Outro":     "bg-gray-700 text-gray-400",
};

export default function RendaFixaPage() {
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState("");
  const [typeFilter, setTypeFilter] = useState<Bond["type"] | "Todos">("Todos");

  // Simulação
  const [selectedBond, setSelectedBond] = useState<Bond | null>(null);
  const [mode, setMode] = useState<SimMode>("quanto-aportar");
  const [pvInput, setPvInput] = useState("0");
  const [pmtInput, setPmtInput] = useState("1000");
  const [fvInput, setFvInput] = useState("1000000");
  const [inflacaoInput, setInflacaoInput] = useState("4.5"); // para IPCA+
  const [customRate, setCustomRate] = useState(""); // taxa manual se não selecionar título

  const effectiveRate = useMemo(() => {
    if (customRate && !selectedBond) {
      const n = parseFloat(customRate.replace(",", "."));
      return isNaN(n) ? 0 : n;
    }
    if (!selectedBond) return 0;
    if (selectedBond.type === "IPCA+") {
      // taxa nominal ≈ (1 + spread) × (1 + inflação) - 1
      const spread = selectedBond.annualRate / 100;
      const infl = parseFloat(inflacaoInput.replace(",", ".")) / 100 || 0.045;
      return ((1 + spread) * (1 + infl) - 1) * 100;
    }
    return selectedBond.annualRate;
  }, [selectedBond, customRate, inflacaoInput]);

  const maturityMonths = useMemo(() => {
    if (!selectedBond) return 60;
    return Math.max(1, Math.round(yearsUntil(selectedBond.maturity) * 12));
  }, [selectedBond]);

  const pv  = parseFloat(pvInput.replace(/\./g, "").replace(",", ".")) || 0;
  const pmt = parseFloat(pmtInput.replace(/\./g, "").replace(",", ".")) || 0;
  const fv  = parseFloat(fvInput.replace(/\./g, "").replace(",", ".")) || 0;

  const sim = useMemo(() => {
    if (effectiveRate <= 0) return null;
    const n = maturityMonths;

    if (mode === "quanto-recebo") {
      const result = calcFV(pv, pmt, effectiveRate, n);
      const totalInvested = pv + pmt * n;
      return { fvResult: result, totalInvested, juros: result - totalInvested, months: n };
    }
    if (mode === "quanto-aportar") {
      const pmtResult = calcPMT(pv, fv, effectiveRate, n);
      const totalInvested = pv + pmtResult * n;
      return { pmtResult, totalInvested, juros: fv - totalInvested, months: n };
    }
    // em quanto tempo
    const nResult = calcMonths(pv, pmt, fv, effectiveRate);
    if (nResult === null) return null;
    const fvResult = calcFV(pv, pmt, effectiveRate, nResult);
    const totalInvested = pv + pmt * nResult;
    return { nResult, fvResult, totalInvested, juros: fvResult - totalInvested };
  }, [mode, pv, pmt, fv, effectiveRate, maturityMonths]);

  useEffect(() => {
    fetch("/api/tesouro-rates")
      .then((r) => r.json())
      .then((d) => {
        setBonds(d.bonds ?? []);
        setFetchedAt(d.fetchedAt ?? "");
        setLoading(false);
        if (d.error) setError(d.error);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = typeFilter === "Todos" ? bonds : bonds.filter((b) => b.type === typeFilter);
  const types = [...new Set(bonds.map((b) => b.type))].sort() as Bond["type"][];

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <div className="flex items-start justify-between">
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
              <button
                key={t}
                onClick={() => setTypeFilter(t as typeof typeFilter)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  typeFilter === t ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-400 hover:border-gray-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="text-gray-400 text-sm">Buscando taxas...</p>}
        {error && <p className="text-red-400 text-sm">Erro ao buscar taxas: {error}. Use a taxa manual no simulador abaixo.</p>}

        {!loading && bonds.length === 0 && !error && (
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
                  <tr
                    key={b.name}
                    className={`border-b border-gray-800 hover:bg-gray-800/30 cursor-pointer ${selectedBond?.name === b.name ? "bg-blue-900/20" : ""}`}
                    onClick={() => { setSelectedBond((s) => s?.name === b.name ? null : b); setCustomRate(""); }}
                  >
                    <td className="py-2 pr-4 text-gray-200">{b.name}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[b.type]}`}>{b.type}</span>
                    </td>
                    <td className="py-2 pr-4 text-gray-400">{maturityLabel(b.maturity)}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-green-400">{fmtPct(b.annualRate)}</td>
                    <td className="py-2 pr-4 text-right text-gray-300">{fmtBRL(b.unitPrice)}</td>
                    <td className="py-2 pr-4 text-right text-gray-400">{fmtBRL(b.minAmount)}</td>
                    <td className="py-2 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedBond((s) => s?.name === b.name ? null : b); setCustomRate(""); }}
                        className={`text-xs px-3 py-1 rounded border transition-colors ${selectedBond?.name === b.name ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-400 hover:border-blue-500"}`}
                      >
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

        {selectedBond ? (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg text-sm">
            <span className="text-blue-300 font-medium">{selectedBond.name}</span>
            <span className="text-gray-400 ml-3">venc. {maturityLabel(selectedBond.maturity)} · {maturityMonths} meses restantes</span>
            {selectedBond.type === "IPCA+" && (
              <span className="text-purple-300 ml-3">spread {fmtPct(selectedBond.annualRate)} + IPCA</span>
            )}
            <button onClick={() => setSelectedBond(null)} className="ml-3 text-gray-500 hover:text-gray-300 text-xs">✕ limpar</button>
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs text-gray-400">Ou insira a taxa manualmente:</span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customRate}
                onChange={(e) => { setCustomRate(e.target.value); setSelectedBond(null); }}
                placeholder="ex: 15.32"
                className="w-24 bg-gray-700 border border-gray-600 text-white text-sm text-center rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-gray-400">% a.a.</span>
            </div>
          </div>
        )}

        {/* IPCA assumption */}
        {selectedBond?.type === "IPCA+" && (
          <div className="mb-4 flex items-center gap-3 text-sm">
            <span className="text-xs text-gray-400">Inflação anual assumida (IPCA):</span>
            <input
              type="text"
              value={inflacaoInput}
              onChange={(e) => setInflacaoInput(e.target.value)}
              className="w-20 bg-gray-700 border border-gray-600 text-white text-sm text-center rounded px-2 py-1 focus:outline-none focus:border-purple-500"
            />
            <span className="text-xs text-gray-400">% a.a.</span>
            <span className="text-xs text-gray-500">Taxa nominal efetiva: <span className="text-purple-300 font-medium">{fmtPct(effectiveRate)}</span></span>
          </div>
        )}

        {/* Modo */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {([
            { key: "quanto-recebo", label: "Quanto terei?" },
            { key: "quanto-aportar", label: "Quanto preciso aportar/mês?" },
            { key: "em-quanto-tempo", label: "Em quanto tempo?" },
          ] as { key: SimMode; label: string }[]).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${mode === m.key ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-400 hover:border-gray-400"}`}
            >
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

          {!selectedBond && (
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Prazo (meses)</span>
              <input type="number" min={1} max={600}
                value={maturityMonths}
                readOnly={!!selectedBond}
                onChange={() => {}}
                className="w-full bg-gray-700 border border-gray-600 text-gray-400 text-sm rounded px-3 py-2 cursor-not-allowed"
              />
            </label>
          )}
        </div>

        {/* Resultado */}
        {effectiveRate > 0 && sim && (
          <div className="bg-gray-900/60 rounded-lg border border-gray-600 p-5">
            <div className="text-xs text-gray-400 mb-3">
              Taxa efetiva: <span className="text-green-400 font-semibold">{fmtPct(effectiveRate)} a.a.</span>
              {selectedBond && <span className="ml-2">· venc. {maturityLabel(selectedBond.maturity)}</span>}
              {selectedBond && <span className="ml-2 text-gray-500">({maturityMonths} meses)</span>}
            </div>

            {mode === "quanto-recebo" && "fvResult" in sim && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-400">Patrimônio final</div>
                  <div className="text-2xl font-bold text-green-400">{fmtBRL(sim.fvResult)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total investido</div>
                  <div className="text-lg font-semibold text-gray-200">{fmtBRL(sim.totalInvested)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Juros ganhos</div>
                  <div className="text-lg font-semibold text-blue-400">{fmtBRL(sim.juros)}</div>
                </div>
              </div>
            )}

            {mode === "quanto-aportar" && "pmtResult" in sim && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-400">Aporte mensal necessário</div>
                  <div className="text-2xl font-bold text-green-400">{fmtBRL(Math.max(0, sim.pmtResult))}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total investido</div>
                  <div className="text-lg font-semibold text-gray-200">{fmtBRL(sim.totalInvested)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Juros ganhos</div>
                  <div className="text-lg font-semibold text-blue-400">{fmtBRL(sim.juros)}</div>
                </div>
              </div>
            )}

            {mode === "em-quanto-tempo" && "nResult" in sim && sim.nResult && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-400">Tempo para atingir objetivo</div>
                  <div className="text-2xl font-bold text-green-400">
                    {sim.nResult} meses
                    <span className="text-base font-normal text-gray-400 ml-2">({(sim.nResult / 12).toFixed(1)} anos)</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Patrimônio final</div>
                  <div className="text-lg font-semibold text-gray-200">{fmtBRL(sim.fvResult)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total investido</div>
                  <div className="text-lg font-semibold text-blue-400">{fmtBRL(sim.totalInvested)}</div>
                </div>
              </div>
            )}

            {/* Progressão anual */}
            <div className="mt-5 overflow-x-auto">
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
                  {Array.from({ length: Math.min(12, Math.ceil((sim as { months?: number; nResult?: number }).months ?? (sim as { nResult?: number }).nResult ?? 60) / 12) }, (_, i) => {
                    const months = (i + 1) * 12;
                    const usePmt = mode === "quanto-aportar" && "pmtResult" in sim ? sim.pmtResult : pmt;
                    const fvAt = calcFV(pv, Math.max(0, usePmt), effectiveRate, months);
                    const invested = pv + Math.max(0, usePmt) * months;
                    return (
                      <tr key={i} className="border-b border-gray-800">
                        <td className="py-1 pr-3 text-gray-400">{new Date().getFullYear() + i + 1}</td>
                        <td className="py-1 pr-3 text-right text-gray-400">{months}</td>
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
        )}

        {effectiveRate <= 0 && (
          <div className="text-gray-500 text-sm">Selecione um título na tabela acima ou insira a taxa manualmente para simular.</div>
        )}
      </section>

      <p className="text-xs text-gray-600">
        Simulação com reinvestimento de cupons (juros compostos mensais). Para IPCA+, a taxa nominal é calculada como (1 + spread) × (1 + inflação assumida) − 1. Rentabilidade passada não garante retorno futuro.
      </p>
    </main>
  );
}
