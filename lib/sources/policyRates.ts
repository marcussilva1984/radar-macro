// Taxas de juros de referência dos bancos centrais, por moeda. Manual — não existe fonte
// grátis confiável/estruturada pra isso; atualize quando algum BC mudar a taxa (a timeline
// de eventos em / já avisa quando isso acontece).
// Última atualização manual: ver `updatedAt` abaixo.
export const POLICY_RATES: Record<string, number> = {
  USD: 4.0, // Fed funds rate (topo da banda)
  EUR: 2.0, // ECB deposit facility rate
  GBP: 4.0, // BoE bank rate
  CHF: 0.0, // SNB policy rate
  JPY: 0.5, // BoJ policy rate
  AUD: 3.6, // RBA cash rate
  NZD: 3.0, // RBNZ OCR
};

export const POLICY_RATES_UPDATED_AT = "2026-08-22";
