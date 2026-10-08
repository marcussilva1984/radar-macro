import "server-only";
import { fetchLiveQuote } from "@/lib/sources/yahoo";
import { getCoinMarkets } from "@/lib/sources/coingecko";
import { mapWithConcurrency } from "@/lib/concurrency";

export interface TickerItem {
  label: string;
  price: number;
  changePct: number;
  kind: "forex" | "crypto";
}

// Pares/moedas principais pro índice DXY + a faixa "Pares principais" e a guia que roda na
// tela — subconjunto do watchlist completo de FX_PAIRS, só os mais líquidos (G7 + BRL).
export const DXY_SYMBOL = "DX-Y.NYB";
export const MAIN_FX_PAIRS: { label: string; yahoo: string }[] = [
  { label: "EUR/USD", yahoo: "EURUSD=X" },
  { label: "GBP/USD", yahoo: "GBPUSD=X" },
  { label: "USD/JPY", yahoo: "USDJPY=X" },
  { label: "USD/CHF", yahoo: "USDCHF=X" },
  { label: "USD/CAD", yahoo: "USDCAD=X" },
  { label: "AUD/USD", yahoo: "AUDUSD=X" },
  { label: "NZD/USD", yahoo: "NZDUSD=X" },
  { label: "USD/BRL", yahoo: "USDBRL=X" },
];

const TICKER_CRYPTO_IDS = ["bitcoin", "ethereum", "solana", "hyperliquid", "chainlink"];

export async function getMainFxQuotes(): Promise<(TickerItem & { kind: "forex" })[]> {
  const results = await mapWithConcurrency(MAIN_FX_PAIRS, 4, async (p) => {
    const q = await fetchLiveQuote(p.yahoo);
    return q ? { label: p.label, price: q.price, changePct: q.changePct, kind: "forex" as const } : null;
  });
  return results.filter((r): r is TickerItem & { kind: "forex" } => r !== null);
}

export async function getDxyQuote(): Promise<TickerItem | null> {
  const q = await fetchLiveQuote(DXY_SYMBOL);
  return q ? { label: "DXY", price: q.price, changePct: q.changePct, kind: "forex" } : null;
}

// Watchlist da guia que roda na tela: pares principais de forex + as 5 criptos acompanhadas
// no site (mesmas do board de Cripto) — nada de ações/FIIs aqui, só forex+cripto como pedido.
export async function getTickerItems(): Promise<TickerItem[]> {
  const [fx, coins] = await Promise.all([getMainFxQuotes(), getCoinMarkets(TICKER_CRYPTO_IDS)]);
  const cryptoItems: TickerItem[] = coins
    .filter((c) => c.changePct24h !== null)
    .map((c) => ({ label: c.symbol, price: c.price, changePct: c.changePct24h as number, kind: "crypto" as const }));
  return [...fx, ...cryptoItems];
}
