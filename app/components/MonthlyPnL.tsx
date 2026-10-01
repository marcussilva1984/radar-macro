import type { BalanceEntry } from "@/lib/brokerPortfolio";

function money(v: number) {
  return `$${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
}
function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function monthReturn(entries: BalanceEntry[], broker: string, month: string) {
  const bEntries = entries.filter((e) => e.broker === broker).sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  const monthKey = (d: Date) => d.toISOString().slice(0, 7);
  const monthEntries = bEntries.filter((e) => monthKey(e.entryDate) === month);
  if (monthEntries.length === 0) return null;

  const lastOfMonth = monthEntries[monthEntries.length - 1];
  const prevEntry = bEntries.filter((e) => monthKey(e.entryDate) < month).slice(-1)[0];
  if (!prevEntry) return null;

  const deposits = monthEntries.reduce((s, e) => s + e.deposit, 0);
  const withdrawals = monthEntries.reduce((s, e) => s + e.withdrawal, 0);
  const profit = lastOfMonth.balance - prevEntry.balance - deposits + withdrawals;
  const pctVal = prevEntry.balance > 0 ? (profit / prevEntry.balance) * 100 : 0;
  return { profit, pct: pctVal };
}

export function MonthlyPnL({ entries, brokers }: { entries: BalanceEntry[]; brokers: readonly string[] }) {
  const months = Array.from(new Set(entries.map((e) => e.entryDate.toISOString().slice(0, 7)))).sort().reverse();
  if (months.length === 0) return <p className="text-sm text-zinc-500">Sem dados mensais ainda.</p>;

  function totalReturn(month: string) {
    const results = brokers.map((b) => monthReturn(entries, b, month)).filter((r): r is { profit: number; pct: number } => r !== null);
    if (results.length === 0) return null;
    const totalProfit = results.reduce((s, r) => s + r.profit, 0);
    let base = 0;
    for (const b of brokers) {
      const before = entries.filter((e) => e.broker === b && e.entryDate.toISOString().slice(0, 7) < month);
      if (before.length > 0) base += before.sort((a, z) => z.entryDate.getTime() - a.entryDate.getTime())[0].balance;
    }
    return { profit: totalProfit, pct: base > 0 ? (totalProfit / base) * 100 : 0 };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
            <th className="py-2 pr-4">Mês</th>
            {brokers.map((b) => (
              <th key={b} className="py-2 pr-4 text-right">{b}</th>
            ))}
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => {
            const total = totalReturn(month);
            return (
              <tr key={month} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-1.5 pr-4 text-zinc-500">
                  {new Date(`${month}-15`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </td>
                {brokers.map((b) => {
                  const r = monthReturn(entries, b, month);
                  return (
                    <td key={b} className="py-1.5 pr-4 text-right">
                      {r ? (
                        <span className={r.pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} title={money(r.profit)}>
                          {pct(r.pct)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-1.5 text-right font-medium">
                  {total ? (
                    <span className={total.pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} title={money(total.profit)}>
                      {pct(total.pct)}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-zinc-500">
        Lucro mensal = saldo final do mês − saldo final do mês anterior − depósitos + retiradas. Passe o mouse no % pra ver o valor em USD.
      </p>
    </div>
  );
}
