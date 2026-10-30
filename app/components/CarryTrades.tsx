import { CARRY_STATUS_ICON, CARRY_STATUS_LABEL, type CarryIdea } from "@/lib/carryTrades";
import {
  POLICY_RATE_INFO,
  POLICY_RATES_STALE_AFTER_DAYS,
  POLICY_RATES_UPDATED_AT,
  policyRatesAgeDays,
} from "@/lib/sources/policyRates";

function pct(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function changeColor(v: number | null) {
  if (v === null) return "text-zinc-400";
  return v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}
function brDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function StaleWarning() {
  const age = policyRatesAgeDays();
  if (age <= POLICY_RATES_STALE_AFTER_DAYS) return null;
  return (
    <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      ⚠️ Taxas de juros conferidas há {age} dias ({brDate(POLICY_RATES_UPDATED_AT)}) — algum banco
      central pode ter mudado desde então. Peça pra atualizar.
    </p>
  );
}

function actionText(i: CarryIdea) {
  return `${i.action === "compra" ? "Comprar" : "Vender"} ${i.label}`;
}

// Painel fixo da aba Forex: ranking de carry trades + tabela de juros usada no cálculo.
export function CarryTradesPanel({ ideas }: { ideas: CarryIdea[] }) {
  const rates = Object.entries(POLICY_RATE_INFO).sort((a, b) => b[1].rate - a[1].rate);

  return (
    <div>
      <p className="mt-1 text-xs text-zinc-500">
        Carry = ficar na moeda de juro maior contra a de juro menor e receber o swap. Só compensa
        se o preço não andar contra. ✅ carry + preço a favor no diário e semanal · 🟡 a favor na
        semana · ⚪ preço de lado · 🔴 preço contra. Juros conferidos em {brDate(POLICY_RATES_UPDATED_AT)}.
      </p>
      <StaleWarning />

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-3"></th>
              <th className="py-2 pr-3">Operação</th>
              <th className="py-2 pr-3 text-right">Carry a.a.</th>
              <th className="py-2 pr-3 text-right">Swap/lote/dia*</th>
              <th className="py-2 pr-3 text-right">Dia</th>
              <th className="py-2 text-right">Semana</th>
            </tr>
          </thead>
          <tbody>
            {ideas.map((i) => (
              <tr key={i.pair} className="border-b border-zinc-100 dark:border-zinc-900" title={CARRY_STATUS_LABEL[i.status]}>
                <td className="py-2 pr-3">{CARRY_STATUS_ICON[i.status]}</td>
                <td className="py-2 pr-3 font-medium text-black dark:text-zinc-50">{actionText(i)}</td>
                <td className="py-2 pr-3 text-right text-green-600 dark:text-green-400">+{i.carryPp.toFixed(2)}pp</td>
                <td className="py-2 pr-3 text-right text-zinc-600 dark:text-zinc-400">~${i.swapPerLotPerDay.toFixed(2)}</td>
                <td className={`py-2 pr-3 text-right ${changeColor(i.changePct)}`}>{pct(i.changePct)}</td>
                <td className={`py-2 text-right ${changeColor(i.weeklyChangePct)}`}>{pct(i.weeklyChangePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        *Swap teórico de 1 lote padrão sem o desconto da corretora — o swap real costuma ser menor.
        Dia/Semana = variação do par.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {rates.map(([currency, info]) => (
          <div
            key={currency}
            className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            title={info.lastChange ? `Última mudança: ${brDate(info.lastChange)}` : undefined}
          >
            <span className="font-medium text-black dark:text-zinc-50">{currency}</span>{" "}
            <span className="text-zinc-700 dark:text-zinc-300">{info.rate.toFixed(2)}%</span>{" "}
            <span className="text-zinc-500">{info.bank}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Barra lateral da Carteira: onde o carry está pagando agora e o que evitar.
export function CarrySidebar({ ideas }: { ideas: CarryIdea[] }) {
  const best = ideas.filter((i) => i.status === "confirmado").slice(0, 4);
  const watch = ideas.filter((i) => i.status === "a-favor").slice(0, 3);
  const avoid = ideas.filter((i) => i.status === "contra").sort((a, b) => b.carryPp - a.carryPp).slice(0, 3);

  return (
    <aside className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-base font-medium text-black dark:text-zinc-50">Dicas de carry trade</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Onde o juro está a seu favor agora. Heurística, não recomendação — a decisão é sua.
      </p>
      <StaleWarning />

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
        ✅ Melhores agora
      </h3>
      {best.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-500">Nenhum par com carry e preço a favor no diário e semanal hoje.</p>
      ) : (
        <ul className="mt-1 space-y-2">
          {best.map((i) => (
            <li key={i.pair} className="rounded border border-green-200 bg-green-50 p-2 dark:border-green-900 dark:bg-green-950">
              <p className="font-medium text-green-900 dark:text-green-200">{actionText(i)}</p>
              <p className="text-xs text-green-800 dark:text-green-300">
                Recebe +{i.carryPp.toFixed(2)}% a.a. (~${i.swapPerLotPerDay.toFixed(2)}/lote/dia) · semana{" "}
                {pct(i.weeklyChangePct)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {watch.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-500">
            🟡 De olho
          </h3>
          <ul className="mt-1 space-y-1">
            {watch.map((i) => (
              <li key={i.pair} className="text-xs text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">{actionText(i)}</span> · +{i.carryPp.toFixed(2)}pp · semana a favor, falta o diário confirmar
              </li>
            ))}
          </ul>
        </>
      )}

      {avoid.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
            🔴 Cuidado: carry alto, preço contra
          </h3>
          <ul className="mt-1 space-y-1">
            {avoid.map((i) => (
              <li key={i.pair} className="text-xs text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">{actionText(i)}</span> · semana {pct(i.weeklyChangePct)} — o swap
                (+{i.carryPp.toFixed(2)}% a.a.) não cobre essa queda
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        Regra prática: se a posição está no prejuízo, o preço vai contra no diário e no semanal e o
        swap é negativo, segurar só aumenta a perda.
      </p>
    </aside>
  );
}
