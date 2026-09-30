import { getBrokerSummaries, getAllEntries, type PeriodStats } from "@/lib/brokerPortfolio";
import { BrokerBalanceForm } from "@/app/components/BrokerBalanceForm";
import { PortfolioSimulator } from "@/app/components/PortfolioSimulator";

export const dynamic = "force-dynamic";

function pctColor(v: number | null) {
  if (v === null) return "text-zinc-400";
  return v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function money(v: number, opts?: Intl.NumberFormatOptions) {
  return `$${v.toLocaleString("pt-BR", { maximumFractionDigits: 2, ...opts })}`;
}

function PeriodCell({ p }: { p: PeriodStats | null }) {
  if (!p) return <td className="py-2 pr-4 align-top text-zinc-400">—</td>;
  return (
    <td className={`py-2 pr-4 align-top ${pctColor(p.profit)}`}>
      <div className="font-medium">
        {money(p.profit)} ({p.profitPct.toFixed(1)}%)
      </div>
      <div className="mt-0.5 text-xs font-normal text-zinc-500">
        {p.deposits > 0 && <span>depósito {money(p.deposits)} </span>}
        {p.withdrawals > 0 && <span>retirada {money(p.withdrawals)}</span>}
        {p.deposits === 0 && p.withdrawals === 0 && <span>sem aporte/saque</span>}
      </div>
    </td>
  );
}

export default async function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias } = await searchParams;
  const days = Math.min(30, Math.max(1, Number(dias) || 7));

  let summaries: Awaited<ReturnType<typeof getBrokerSummaries>> = [];
  let entries: Awaited<ReturnType<typeof getAllEntries>> = [];
  let error: string | null = null;

  try {
    [summaries, entries] = await Promise.all([getBrokerSummaries(days), getAllEntries()]);
  } catch (e) {
    error = (e as Error).message;
  }

  const totalBalance = summaries.reduce((acc, s) => acc + (s.currentBalance ?? 0), 0);
  const withData = summaries.map((s) => s.period).filter((p): p is PeriodStats => p !== null);
  const totalPeriod: PeriodStats | null =
    withData.length === 0
      ? null
      : (() => {
          const profit = withData.reduce((acc, p) => acc + p.profit, 0);
          const deposits = withData.reduce((acc, p) => acc + p.deposits, 0);
          const withdrawals = withData.reduce((acc, p) => acc + p.withdrawals, 0);
          const base = totalBalance - profit;
          return { profit, profitPct: base > 0 ? (profit / base) * 100 : 0, deposits, withdrawals };
        })();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Carteira</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Saldo das suas corretoras de forex (preenchimento manual). Lucro descontando
        depósitos/retiradas do período, pra não confundir aporte com ganho — em USD.
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}

      {!error && (
        <>
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500">Novo lançamento</p>
            <div className="mt-2">
              <BrokerBalanceForm />
            </div>
          </div>

          <form
            method="get"
            className="mt-6 flex items-end gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div>
              <label htmlFor="dias" className="block text-xs font-medium text-zinc-500">
                Lucro dos últimos N dias (1 a 30)
              </label>
              <input
                id="dias"
                name="dias"
                type="number"
                min={1}
                max={30}
                defaultValue={days}
                className="mt-1 w-24 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Aplicar
            </button>
          </form>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-4">Corretora</th>
                  <th className="py-2 pr-4">Saldo</th>
                  <th className="py-2 pr-4">
                    Lucro {days} dia{days > 1 ? "s" : ""} (lucro % · depósito · retirada)
                  </th>
                  <th className="py-2">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.broker} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4 align-top font-medium text-black dark:text-zinc-50">
                      {s.broker}
                    </td>
                    <td className="py-2 pr-4 align-top">
                      {s.currentBalance !== null ? money(s.currentBalance) : "—"}
                    </td>
                    <PeriodCell p={s.period} />
                    <td className="py-2 align-top text-xs text-zinc-500">
                      {s.lastEntryDate ? s.lastEntryDate.toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold text-black dark:text-zinc-50">
                  <td className="py-2 pr-4 align-top">Total</td>
                  <td className="py-2 pr-4 align-top">{money(totalBalance)}</td>
                  <PeriodCell p={totalPeriod} />
                  <td></td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-zinc-500">
              Só calcula quando houver um lançamento anterior à janela escolhida — com um único
              saldo cadastrado, ainda não dá pra calcular.
            </p>
          </div>

          <h2 className="mt-10 text-lg font-medium text-black dark:text-zinc-50">
            Histórico de lançamentos
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Cada linha é um lançamento seu — pra você ver exatamente quando fez cada depósito,
            retirada ou atualização de saldo.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Corretora</th>
                  <th className="py-2 pr-4">Saldo</th>
                  <th className="py-2 pr-4">Depósito</th>
                  <th className="py-2">Retirada</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4 text-zinc-500">{e.entryDate.toLocaleDateString("pt-BR")}</td>
                    <td className="py-2 pr-4 font-medium text-black dark:text-zinc-50">{e.broker}</td>
                    <td className="py-2 pr-4">{money(e.balance)}</td>
                    <td className="py-2 pr-4 text-green-600 dark:text-green-400">
                      {e.deposit > 0 ? money(e.deposit) : "—"}
                    </td>
                    <td className="py-2 text-red-600 dark:text-red-400">
                      {e.withdrawal > 0 ? money(e.withdrawal) : "—"}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-zinc-500">
                      Nenhum lançamento ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PortfolioSimulator initialBalance={totalBalance} />
        </>
      )}
    </div>
  );
}
