"use client";

import { useState } from "react";
import type { BalanceEntry } from "@/lib/brokerPortfolio";

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function money(v: number) {
  return `$${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
}

// Lucro agregado (todas corretoras) entre duas datas — baseline é o último lançamento ANTES
// de `start`, e só entra no cálculo quem já tinha um lançamento antes do período (sem isso o
// primeiro saldo cadastrado pareceria "lucro" do nada).
function periodReturn(
  entries: BalanceEntry[],
  brokers: readonly string[],
  start: Date,
  end: Date
): { profit: number; base: number; pct: number } | null {
  let totalProfit = 0;
  let totalBase = 0;
  let hasAny = false;

  for (const broker of brokers) {
    const bEntries = entries.filter((e) => e.broker === broker).sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
    const baseline = bEntries.filter((e) => e.entryDate <= start).slice(-1)[0];
    if (!baseline) continue;
    const inWindow = bEntries.filter((e) => e.entryDate > start && e.entryDate <= end);
    if (inWindow.length === 0) continue; // sem lançamento dentro da janela — não participa

    const last = inWindow[inWindow.length - 1];
    const deposits = inWindow.reduce((s, e) => s + e.deposit, 0);
    const withdrawals = inWindow.reduce((s, e) => s + e.withdrawal, 0);
    const profit = last.balance - baseline.balance - deposits + withdrawals;
    totalProfit += profit;
    totalBase += baseline.balance;
    hasAny = true;
  }

  if (!hasAny) return null;
  return { profit: totalProfit, base: totalBase, pct: totalBase > 0 ? (totalProfit / totalBase) * 100 : 0 };
}

export function MonthGoalPanel({ entries, brokers }: { entries: BalanceEntry[]; brokers: readonly string[] }) {
  const [goalPct, setGoalPct] = useState("2");
  const goalVal = Number(goalPct) || 0;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const monthStart = new Date(year, month, 1);

  const monthDone = periodReturn(entries, brokers, monthStart, now);
  const proRataPct = (goalVal * daysElapsed) / daysInMonth;
  const doneActualPct = monthDone?.pct ?? 0;
  const diff = doneActualPct - proRataPct;
  const progressOfGoal = goalVal > 0 ? Math.max(0, Math.min(100, (doneActualPct / goalVal) * 100)) : 0;

  // 4 janelas quase iguais dividindo o mês corrente — "Semana 1..4".
  const weekWidth = Math.ceil(daysInMonth / 4);
  const weeks = [0, 1, 2, 3].map((i) => {
    const startDay = i * weekWidth;
    const endDay = Math.min(daysInMonth, (i + 1) * weekWidth);
    const start = new Date(year, month, startDay); // dia 0 do mês = último dia do mês anterior, cobre a borda
    const end = new Date(year, month, endDay, 23, 59, 59);
    const r = periodReturn(entries, brokers, start, end);
    const weekGoal = goalVal / 4;
    return { label: `Semana ${i + 1}`, r, weekGoal };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Meta mensal (%)</label>
          <input
            type="number"
            step="0.1"
            value={goalPct}
            onChange={(e) => setGoalPct(e.target.value)}
            className="mt-1 w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Meta: <span className="font-medium text-black dark:text-zinc-50">{pct(goalVal)}</span> no mês
          <br />
          Pró-rata até dia {daysElapsed}/{daysInMonth}: {pct(proRataPct)}
        </p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className={diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
            Feito: {pct(doneActualPct)}
          </span>
          <span className={diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
            {diff >= 0 ? "+" : ""}
            {pct(diff)} {diff >= 0 ? "à frente" : "atrás"} da meta pró-rata
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full ${doneActualPct >= 0 ? "bg-green-500" : "bg-red-500"}`}
            style={{ width: `${progressOfGoal}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-zinc-500">{progressOfGoal.toFixed(0)}% da meta</p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-1.5 pr-4">Período</th>
              <th className="py-1.5 pr-4 text-right">Performance</th>
              <th className="py-1.5 pr-4 text-right">USD</th>
              <th className="py-1.5 text-right">vs meta semana</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.label} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-1.5 pr-4 text-zinc-500">{w.label}</td>
                <td className="py-1.5 pr-4 text-right">
                  {w.r ? (
                    <span className={w.r.pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{pct(w.r.pct)}</span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="py-1.5 pr-4 text-right text-zinc-500">{w.r ? money(w.r.profit) : "—"}</td>
                <td className="py-1.5 text-right">
                  {w.r ? (
                    <span className={w.r.pct - w.weekGoal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {pct(w.r.pct - w.weekGoal)}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-zinc-500">
          Meta semana = meta mensal ÷ 4. Só aparece quando há lançamentos dos dois lados da janela.
        </p>
      </div>
    </div>
  );
}
