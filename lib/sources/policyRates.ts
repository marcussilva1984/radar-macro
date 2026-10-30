// Taxas de juros de referência dos bancos centrais, por moeda. Manual — não existe fonte
// grátis confiável/estruturada pra isso; atualize quando algum BC mudar a taxa (a timeline
// de eventos em / já avisa quando isso acontece). Conferidas nos sites oficiais em 30/10/2026
// (RBNZ e BoJ via cobertura de imprensa — os sites oficiais bloquearam a consulta automática).
export interface PolicyRateInfo {
  rate: number;
  bank: string;
  lastChange: string; // data da última mudança conhecida (AAAA-MM-DD) ou "" se não confirmada
}

export const POLICY_RATE_INFO: Record<string, PolicyRateInfo> = {
  USD: { rate: 4.0, bank: "Fed (topo da banda)", lastChange: "" },
  EUR: { rate: 2.5, bank: "BCE (depósito)", lastChange: "2026-09-16" },
  GBP: { rate: 3.75, bank: "BoE", lastChange: "" },
  CHF: { rate: 0.0, bank: "SNB", lastChange: "" },
  JPY: { rate: 1.25, bank: "BoJ", lastChange: "2026-09-18" },
  AUD: { rate: 4.6, bank: "RBA", lastChange: "2026-09-30" },
  NZD: { rate: 2.75, bank: "RBNZ", lastChange: "" },
};

export const POLICY_RATES: Record<string, number> = Object.fromEntries(
  Object.entries(POLICY_RATE_INFO).map(([currency, info]) => [currency, info.rate])
);

export const POLICY_RATES_UPDATED_AT = "2026-10-30";

// Depois disso o painel de carry avisa que as taxas podem estar velhas (bancos centrais se
// reúnem a cada ~6 semanas).
export const POLICY_RATES_STALE_AFTER_DAYS = 45;

export function policyRatesAgeDays(now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(`${POLICY_RATES_UPDATED_AT}T12:00:00Z`).getTime()) / 86_400_000);
}
