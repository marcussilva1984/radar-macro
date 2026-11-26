"use client";

import { useEffect, useState } from "react";

// Salvo só no navegador: o site não tem senha em produção, então nada vai pro banco.
const STORAGE_KEY = "radar-macro:carteira-renda-fixa";

interface Position {
  id: number;
  name: string;
  date: string;     // data da aplicação "AAAA-MM-DD"
  maturity: string; // "AAAA-MM-DD"
  amount: number;
  rate: number;     // % a.a. contratada
}

interface BondOption {
  year: number;
  maturity: string;
  annualRate: number;
  source: string;
}

const FIELD = "w-full bg-zinc-100 dark:bg-gray-700 border border-zinc-300 dark:border-gray-600 text-zinc-900 dark:text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500";
const LABEL = "block text-xs text-zinc-600 dark:text-gray-400 mb-1";

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / DAY);
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (iso: string) => iso.split("-").reverse().join("/");
const today = () => new Date().toLocaleDateString("en-CA");
const toNumber = (s: string) => Number(s.trim().replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));

// Tabela regressiva do IR sobre os juros.
const irRate = (held: number) => (held <= 180 ? 0.225 : held <= 360 ? 0.2 : held <= 720 ? 0.175 : 0.15);

function evaluate(p: Position) {
  const valueAt = (date: string) => p.amount * Math.pow(1 + p.rate / 100, days(p.date, date) / 365);
  const now = valueAt(today() < p.maturity ? today() : p.maturity);
  const final = valueAt(p.maturity);
  const net = final - (final - p.amount) * irRate(days(p.date, p.maturity));
  return { now, final, net };
}

function load(): Position[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

const EMPTY = { name: "", date: "", maturity: "", amount: "", rate: "" };

export function Portfolio({ bonds }: { bonds: BondOption[] }) {
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  useEffect(() => {
    // localStorage só existe no navegador, por isso a leitura depois da montagem.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPositions(load());
    setForm((f) => ({ ...f, date: today() }));
  }, []);

  if (positions === null) return null;

  function save(next: Position[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setPositions(next);
      setError("");
      return true;
    } catch {
      setError("O navegador não deixou salvar (aba anônima ou armazenamento bloqueado).");
      return false;
    }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = toNumber(form.amount);
    const rate = toNumber(form.rate);
    if (!(amount > 0) || !(rate > 0) || !form.date || !(form.maturity > form.date)) {
      setError("Preencha valor, taxa e datas (o vencimento precisa ser depois da aplicação).");
      return;
    }
    const position = { id: Date.now(), name: form.name.trim() || "Prefixado", date: form.date, maturity: form.maturity, amount, rate };
    const next = [...positions!, position].sort((a, b) => a.maturity.localeCompare(b.maturity) || a.date.localeCompare(b.date));
    if (save(next)) setForm({ ...form, amount: "" });
  }

  function remove(p: Position) {
    if (confirm(`Apagar ${p.name}, ${money(p.amount)} de ${brDate(p.date)}?`)) {
      save(positions!.filter((x) => x.id !== p.id));
    }
  }

  function fill(year: string) {
    const b = bonds.find((x) => String(x.year) === year);
    if (!b) return;
    setForm({ ...form, name: `Prefixado ${b.year}`, maturity: b.maturity, rate: b.annualRate.toFixed(2).replace(".", ",") });
  }

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const total = positions.reduce(
    (acc, p) => {
      const v = evaluate(p);
      return { amount: acc.amount + p.amount, now: acc.now + v.now, final: acc.final + v.final, net: acc.net + v.net };
    },
    { amount: 0, now: 0, final: 0, net: 0 }
  );

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="bg-white dark:bg-gray-800/50 border border-zinc-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-gray-200">Adicionar aplicação</h2>
        {bonds.length > 0 && (
          <label className="block max-w-xs">
            <span className={LABEL}>Preencher com um título do Tesouro (opcional)</span>
            <select value="" onChange={(e) => fill(e.target.value)} className={FIELD}>
              <option value="">escolher…</option>
              {bonds.filter((b) => b.source.startsWith("titulo")).map((b) => (
                <option key={b.year} value={b.year}>Prefixado {b.year} — {b.annualRate.toFixed(2)}%</option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <label>
            <span className={LABEL}>Nome</span>
            <input value={form.name} onChange={set("name")} placeholder="CDB, Tesouro…" className={FIELD} />
          </label>
          <label>
            <span className={LABEL}>Valor aplicado (R$)</span>
            <input inputMode="decimal" value={form.amount} onChange={set("amount")} placeholder="400" className={FIELD} />
          </label>
          <label>
            <span className={LABEL}>Taxa (% a.a.)</span>
            <input inputMode="decimal" value={form.rate} onChange={set("rate")} placeholder="15,32" className={FIELD} />
          </label>
          <label>
            <span className={LABEL}>Data da aplicação</span>
            <input type="date" value={form.date} onChange={set("date")} className={FIELD} />
          </label>
          <label>
            <span className={LABEL}>Vencimento</span>
            <input type="date" value={form.maturity} onChange={set("maturity")} className={FIELD} />
          </label>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Adicionar</button>
      </form>

      {positions.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma aplicação ainda. Cada aporte mensal entra como uma linha, com a taxa do dia da compra.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Você aplicou", total.amount],
              ["Vale hoje (bruto)", total.now],
              ["No vencimento (bruto)", total.final],
              ["No vencimento (líquido de IR)", total.net],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-zinc-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{money(value as number)}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="text-sm w-full whitespace-nowrap">
              <thead>
                <tr className="text-gray-500 border-b border-zinc-200 dark:border-gray-700 text-left">
                  <th className="pb-1 pr-4">Título</th>
                  <th className="pb-1 pr-4">Aplicado em</th>
                  <th className="pb-1 pr-4">Vence em</th>
                  <th className="pb-1 pr-4 text-right">Taxa</th>
                  <th className="pb-1 pr-4 text-right">Aplicado</th>
                  <th className="pb-1 pr-4 text-right">Hoje</th>
                  <th className="pb-1 pr-4 text-right">No vencimento</th>
                  <th className="pb-1" />
                </tr>
              </thead>
              <tbody className="text-zinc-700 dark:text-gray-300">
                {positions.map((p) => {
                  const v = evaluate(p);
                  return (
                    <tr key={p.id} className="border-b border-zinc-200 dark:border-gray-800">
                      <td className="py-2 pr-4 font-medium">{p.name}</td>
                      <td className="py-2 pr-4">{brDate(p.date)}</td>
                      <td className="py-2 pr-4">{brDate(p.maturity)}</td>
                      <td className="py-2 pr-4 text-right">{p.rate.toFixed(2)}%</td>
                      <td className="py-2 pr-4 text-right">{money(p.amount)}</td>
                      <td className="py-2 pr-4 text-right">{money(v.now)}</td>
                      <td className="py-2 pr-4 text-right text-green-600 dark:text-green-400">{money(v.final)}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => remove(p)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Apagar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-gray-500">
        Fica salvo só neste navegador (não aparece em outro aparelho e some se você limpar os dados do navegador).
        Valores pela taxa que você contratou; se vender antes do vencimento, o preço de mercado pode ser maior ou menor.
      </p>
    </div>
  );
}
