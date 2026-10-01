"use client";

import { useMemo, useState } from "react";

const fieldClass =
  "mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const labelClass = "block text-xs font-medium text-zinc-500";

interface MonthRow {
  month: number;
  startBalance: number;
  deposit: number;
  gain: number;
  endBalance: number;
}

const MAX_MONTHS = 600; // 50 anos — teto de segurança pra não travar se a taxa/meta forem absurdas

function simulate(initial: number, monthlyDeposit: number, monthlyRatePct: number, target: number): MonthRow[] {
  const rows: MonthRow[] = [];
  let balance = initial;
  let month = 0;

  while (balance < target && month < MAX_MONTHS) {
    month++;
    const startBalance = balance;
    const gain = startBalance * (monthlyRatePct / 100);
    balance = startBalance + gain + monthlyDeposit;
    rows.push({ month, startBalance, deposit: monthlyDeposit, gain, endBalance: balance });
  }

  return rows;
}

function money(v: number) {
  return `$${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
}

interface MonthProgress {
  profit: number;
  baseBalance: number;
  daysElapsed: number;
  daysInMonth: number;
}

export function PortfolioSimulator({
  initialBalance,
  monthProgress,
}: {
  initialBalance: number;
  monthProgress?: MonthProgress | null;
}) {
  const [initial, setInitial] = useState(String(Math.round(initialBalance)));
  const [deposit, setDeposit] = useState("0");
  const [rate, setRate] = useState("2");
  const [target, setTarget] = useState("80000");

  const rows = useMemo(() => {
    const i = Number(initial) || 0;
    const d = Number(deposit) || 0;
    const r = Number(rate) || 0;
    const t = Number(target) || 0;
    if (t <= i) return [];
    return simulate(i, d, r, t);
  }, [initial, deposit, rate, target]);

  const reached = rows.length > 0 && rows.length < MAX_MONTHS;
  const years = rows.length > 0 ? (rows.length / 12).toFixed(1) : null;

  return (
    <div className="mt-10 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-medium text-black dark:text-zinc-50">Simulador de meta</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Juros compostos: saldo inicial + aporte mensal, rendendo a taxa mensal informada, até
        bater a meta. Só simulação — não salva nada, mexe os valores à vontade.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Saldo inicial (USD)</label>
          <input
            type="number"
            step="0.01"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Aporte por mês (USD)</label>
          <input
            type="number"
            step="0.01"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Taxa ao mês (%)</label>
          <input
            type="number"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Meta (USD)</label>
          <input
            type="number"
            step="100"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      {rows.length > 0 && (
        <p className="mt-4 text-sm font-medium text-black dark:text-zinc-50">
          {reached
            ? `Meta de ${money(Number(target) || 0)} atingida em ${rows.length} mês${rows.length > 1 ? "es" : ""} (~${years} anos).`
            : `Não bate a meta em ${MAX_MONTHS} meses com esses valores — aumente o aporte ou a taxa.`}
        </p>
      )}
      {Number(target) <= Number(initial) && (
        <p className="mt-4 text-sm text-zinc-500">A meta já é menor ou igual ao saldo inicial.</p>
      )}

      {monthProgress && (
        <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500">Progresso real deste mês vs. simulado</p>
          {(() => {
            const rateNum = Number(rate) || 0;
            const expectedFullMonth = monthProgress.baseBalance * (rateNum / 100);
            const expectedToDate = (expectedFullMonth * monthProgress.daysElapsed) / monthProgress.daysInMonth;
            const diff = monthProgress.profit - expectedToDate;
            const ahead = diff >= 0;
            return (
              <p className="mt-1 text-sm text-black dark:text-zinc-50">
                Lucro real no mês: <span className={ahead ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{money(monthProgress.profit)}</span>{" "}
                · esperado até hoje (dia {monthProgress.daysElapsed}/{monthProgress.daysInMonth} a {rateNum}%/mês): {money(expectedToDate)} ·{" "}
                {ahead ? "à frente" : "atrás"} da meta em {money(Math.abs(diff))}
              </p>
            );
          })()}
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-3 max-h-80 overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-zinc-950">
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-4">Mês</th>
                <th className="py-2 pr-4">Saldo início</th>
                <th className="py-2 pr-4">Aporte</th>
                <th className="py-2 pr-4">Rendimento</th>
                <th className="py-2">Saldo fim</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-4 text-zinc-500">{r.month}</td>
                  <td className="py-1.5 pr-4">{money(r.startBalance)}</td>
                  <td className="py-1.5 pr-4 text-blue-600 dark:text-blue-400">{money(r.deposit)}</td>
                  <td className="py-1.5 pr-4 text-green-600 dark:text-green-400">{money(r.gain)}</td>
                  <td className="py-1.5 font-medium text-black dark:text-zinc-50">{money(r.endBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
