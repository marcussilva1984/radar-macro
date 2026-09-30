import { getBrokerSummaries } from "@/lib/brokerPortfolio";
import { BrokerBalanceForm } from "@/app/components/BrokerBalanceForm";

export const dynamic = "force-dynamic";

function pctColor(v: number | null) {
  if (v === null) return "text-zinc-400";
  return v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function fmt(v: number | null, opts?: Intl.NumberFormatOptions) {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", opts);
}

export default async function CarteiraPage() {
  let summaries: Awaited<ReturnType<typeof getBrokerSummaries>> = [];
  let error: string | null = null;

  try {
    summaries = await getBrokerSummaries();
  } catch (e) {
    error = (e as Error).message;
  }

  const totalBalance = summaries.reduce((acc, s) => acc + (s.currentBalance ?? 0), 0);
  // null quando NENHUMA corretora tem dado pro período — evita mostrar "$0 (0.0%)" como se
  // fosse lucro zero, quando na verdade é "ainda sem histórico suficiente".
  const sum = (key: "profit7d" | "profit15d" | "profit30d") => {
    const withData = summaries.filter((s) => s[key] !== null);
    if (withData.length === 0) return null;
    return withData.reduce((acc, s) => acc + (s[key] ?? 0), 0);
  };
  const totalPct = (profit: number | null) =>
    profit !== null && totalBalance - profit > 0 ? (profit / (totalBalance - profit)) * 100 : null;

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

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-4">Corretora</th>
                  <th className="py-2 pr-4">Saldo</th>
                  <th className="py-2 pr-4">7 dias</th>
                  <th className="py-2 pr-4">15 dias</th>
                  <th className="py-2 pr-4">30 dias</th>
                  <th className="py-2">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.broker} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4 font-medium text-black dark:text-zinc-50">{s.broker}</td>
                    <td className="py-2 pr-4">
                      {s.currentBalance !== null ? `$${fmt(s.currentBalance, { maximumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className={`py-2 pr-4 ${pctColor(s.profitPct7d)}`}>
                      {s.profit7d !== null ? `$${fmt(s.profit7d, { maximumFractionDigits: 2 })} (${s.profitPct7d!.toFixed(1)}%)` : "—"}
                    </td>
                    <td className={`py-2 pr-4 ${pctColor(s.profitPct15d)}`}>
                      {s.profit15d !== null ? `$${fmt(s.profit15d, { maximumFractionDigits: 2 })} (${s.profitPct15d!.toFixed(1)}%)` : "—"}
                    </td>
                    <td className={`py-2 pr-4 ${pctColor(s.profitPct30d)}`}>
                      {s.profit30d !== null ? `$${fmt(s.profit30d, { maximumFractionDigits: 2 })} (${s.profitPct30d!.toFixed(1)}%)` : "—"}
                    </td>
                    <td className="py-2 text-xs text-zinc-500">
                      {s.lastEntryDate ? s.lastEntryDate.toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold text-black dark:text-zinc-50">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4">${fmt(totalBalance, { maximumFractionDigits: 2 })}</td>
                  <td className={`py-2 pr-4 ${pctColor(sum("profit7d"))}`}>
                    {(() => {
                      const total = sum("profit7d");
                      if (total === null) return "—";
                      const p = totalPct(total);
                      return `$${fmt(total, { maximumFractionDigits: 2 })}${p !== null ? ` (${p.toFixed(1)}%)` : ""}`;
                    })()}
                  </td>
                  <td className={`py-2 pr-4 ${pctColor(sum("profit15d"))}`}>
                    {(() => {
                      const total = sum("profit15d");
                      if (total === null) return "—";
                      const p = totalPct(total);
                      return `$${fmt(total, { maximumFractionDigits: 2 })}${p !== null ? ` (${p.toFixed(1)}%)` : ""}`;
                    })()}
                  </td>
                  <td className={`py-2 pr-4 ${pctColor(sum("profit30d"))}`}>
                    {(() => {
                      const total = sum("profit30d");
                      if (total === null) return "—";
                      const p = totalPct(total);
                      return `$${fmt(total, { maximumFractionDigits: 2 })}${p !== null ? ` (${p.toFixed(1)}%)` : ""}`;
                    })()}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            As colunas de 7/15/30 dias só preenchem depois que houver um lançamento anterior à
            janela — com um único saldo cadastrado (o de hoje), ainda não dá pra calcular.
          </p>
        </>
      )}
    </div>
  );
}
