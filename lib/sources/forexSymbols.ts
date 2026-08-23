// Pares de forex rastreados. Símbolo no formato Yahoo Finance (ex: EURUSD=X).
// "base"/"quote" seguem a convenção: em EUR/USD, EUR é base, USD é quote.
export const FX_PAIRS = [
  { pair: "USDCHF", yahoo: "USDCHF=X", base: "USD", quote: "CHF" },
  { pair: "USDJPY", yahoo: "USDJPY=X", base: "USD", quote: "JPY" },
  { pair: "AUDUSD", yahoo: "AUDUSD=X", base: "AUD", quote: "USD" },
  { pair: "NZDUSD", yahoo: "NZDUSD=X", base: "NZD", quote: "USD" },
  { pair: "EURUSD", yahoo: "EURUSD=X", base: "EUR", quote: "USD" },
  { pair: "GBPUSD", yahoo: "GBPUSD=X", base: "GBP", quote: "USD" },
  { pair: "EURGBP", yahoo: "EURGBP=X", base: "EUR", quote: "GBP" },
  { pair: "EURCHF", yahoo: "EURCHF=X", base: "EUR", quote: "CHF" },
  { pair: "GBPCHF", yahoo: "GBPCHF=X", base: "GBP", quote: "CHF" },
  { pair: "AUDCHF", yahoo: "AUDCHF=X", base: "AUD", quote: "CHF" },
  { pair: "NZDCHF", yahoo: "NZDCHF=X", base: "NZD", quote: "CHF" },
  { pair: "GBPAUD", yahoo: "GBPAUD=X", base: "GBP", quote: "AUD" },
  { pair: "GBPNZD", yahoo: "GBPNZD=X", base: "GBP", quote: "NZD" },
  { pair: "EURAUD", yahoo: "EURAUD=X", base: "EUR", quote: "AUD" },
  { pair: "EURNZD", yahoo: "EURNZD=X", base: "EUR", quote: "NZD" },
  { pair: "AUDNZD", yahoo: "AUDNZD=X", base: "AUD", quote: "NZD" },
] as const;

export type FxPair = (typeof FX_PAIRS)[number]["pair"];

export const FX_CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "AUD", "NZD"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

// Triangulações: cross pair -> os dois pares (contra USD) que implicam seu valor "justo".
// EUR/GBP ~ EURUSD - GBPUSD (em % de variação diária, aproximação aditiva válida p/ moves pequenos).
// GBP/AUD ~ GBPUSD - AUDUSD (AUD/USD já está na convenção base=AUD, quote=USD, mesma direção do USD).
export const TRIANGULATIONS: Array<{ cross: FxPair; legA: FxPair; legB: FxPair; op: "subtract" | "add" }> = [
  { cross: "EURGBP", legA: "EURUSD", legB: "GBPUSD", op: "subtract" },
  { cross: "EURCHF", legA: "EURUSD", legB: "USDCHF", op: "add" },
  { cross: "GBPCHF", legA: "GBPUSD", legB: "USDCHF", op: "add" },
  { cross: "AUDCHF", legA: "AUDUSD", legB: "USDCHF", op: "add" },
  { cross: "NZDCHF", legA: "NZDUSD", legB: "USDCHF", op: "add" },
  { cross: "GBPAUD", legA: "GBPUSD", legB: "AUDUSD", op: "subtract" },
  { cross: "GBPNZD", legA: "GBPUSD", legB: "NZDUSD", op: "subtract" },
  { cross: "EURAUD", legA: "EURUSD", legB: "AUDUSD", op: "subtract" },
  { cross: "EURNZD", legA: "EURUSD", legB: "NZDUSD", op: "subtract" },
  { cross: "AUDNZD", legA: "AUDUSD", legB: "NZDUSD", op: "subtract" },
];

// Pares que compartilham a moeda base e cuja quote (AUD/NZD) é historicamente muito
// correlacionada — a lógica por trás de "se EUR/AUD já caiu bastante e AUD~NZD andam juntas,
// tem espaço pra EUR/NZD seguir na mesma direção". Usado pra gerar as "ideias" na aba Forex.
export const LINKED_CROSS_PAIRS: Array<{ a: FxPair; b: FxPair; via: [FxCurrency, FxCurrency] }> = [
  { a: "EURAUD", b: "EURNZD", via: ["AUD", "NZD"] },
  { a: "GBPAUD", b: "GBPNZD", via: ["AUD", "NZD"] },
  { a: "AUDUSD", b: "NZDUSD", via: ["AUD", "NZD"] },
  { a: "AUDCHF", b: "NZDCHF", via: ["AUD", "NZD"] },
];
