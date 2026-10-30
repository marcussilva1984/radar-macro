import type { FxPairSignal } from "@/lib/forex";

export type CarryStatus = "confirmado" | "a-favor" | "lateral" | "contra";

export interface CarryIdea {
  pair: string;
  label: string; // "EUR/AUD"
  action: "compra" | "venda";
  carryPp: number; // diferencial de juros a favor de quem segue `action`, em pontos percentuais a.a.
  status: CarryStatus;
  changePct: number | null;
  weeklyChangePct: number | null;
  // Swap teórico por lote padrão (100 mil da moeda base), sem o markup da corretora — o swap
  // real cobrado/pago costuma ser menor. Aproximado em USD (não converte a moeda base).
  swapPerLotPerDay: number;
}

const MIN_CARRY_PP = 0.5;
const PRICE_THRESHOLD = 0.1; // % — abaixo disso o par está "andando de lado"

const STATUS_ORDER: Record<CarryStatus, number> = { confirmado: 0, "a-favor": 1, lateral: 2, contra: 3 };

// Carry trade = ficar na moeda de juro maior contra a de juro menor e receber o swap. Só vale a
// pena se o preço não andar contra — por isso o status usa a variação REAL do par (diária e
// semanal), não o "sinal" do Forex (que já embute o próprio carry no cálculo).
export function buildCarryIdeas(signals: FxPairSignal[]): CarryIdea[] {
  const ideas: CarryIdea[] = [];

  for (const s of signals) {
    const carryPp = Math.abs(s.carryDiff);
    if (carryPp < MIN_CARRY_PP) continue;

    const dir = Math.sign(s.carryDiff); // +1 = comprar o par recebe juro, -1 = vender
    const weeklyWithCarry = s.weeklyChangePct !== null ? s.weeklyChangePct * dir : null;
    const dailyWithCarry = s.changePct !== null ? s.changePct * dir : null;

    let status: CarryStatus;
    if (weeklyWithCarry === null || Math.abs(weeklyWithCarry) < PRICE_THRESHOLD) status = "lateral";
    else if (weeklyWithCarry < 0) status = "contra";
    else if (s.trendConsistent && dailyWithCarry !== null && dailyWithCarry > 0) status = "confirmado";
    else status = "a-favor";

    ideas.push({
      pair: s.pair,
      label: `${s.base}/${s.quote}`,
      action: dir > 0 ? "compra" : "venda",
      carryPp,
      status,
      changePct: s.changePct,
      weeklyChangePct: s.weeklyChangePct,
      swapPerLotPerDay: (100_000 * carryPp) / 100 / 365,
    });
  }

  return ideas.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.carryPp - a.carryPp);
}

export const CARRY_STATUS_LABEL: Record<CarryStatus, string> = {
  confirmado: "Carry + preço a favor (diário e semanal)",
  "a-favor": "Carry + preço a favor na semana, diário ainda não confirmou",
  lateral: "Carry a favor, preço de lado",
  contra: "Carry a favor, mas o preço está indo contra",
};

export const CARRY_STATUS_ICON: Record<CarryStatus, string> = {
  confirmado: "✅",
  "a-favor": "🟡",
  lateral: "⚪",
  contra: "🔴",
};
