// Ativos usados como proxy de "força relativa" / rotação de fluxo entre classes.
// Símbolos no formato Yahoo Finance (mesma fonte não-oficial usada no Terminal de Mercado).
export const FLOW_SYMBOLS = [
  { symbol: "DXY", yahoo: "DX-Y.NYB", label: "Dólar (DXY)" },
  { symbol: "GOLD", yahoo: "GC=F", label: "Ouro" },
  { symbol: "US10Y", yahoo: "^TNX", label: "Treasury 10Y (yield)" },
  { symbol: "BTC", yahoo: "BTC-USD", label: "Bitcoin" },
  { symbol: "SPX", yahoo: "^GSPC", label: "S&P 500" },
] as const;

export type FlowSymbol = (typeof FLOW_SYMBOLS)[number]["symbol"];
