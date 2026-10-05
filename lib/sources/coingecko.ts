import "server-only";

export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePct24h: number | null;
  changePct7d: number | null;
}

// CoinGecko free API — sem chave, mas com rate limit agressivo (uso esporádico só).
export async function getCoinMarkets(ids: string[]): Promise<CoinMarket[]> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}&price_change_percentage=24h,7d`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data as Record<string, unknown>[]).map((c) => ({
      id: c.id as string,
      symbol: (c.symbol as string).toUpperCase(),
      name: c.name as string,
      price: c.current_price as number,
      changePct24h: (c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null) as number | null,
      changePct7d: (c.price_change_percentage_7d_in_currency ?? null) as number | null,
    }));
  } catch {
    return [];
  }
}

export interface CoinCategory {
  id: string;
  name: string;
  marketCap: number;
  marketCapChangePct24h: number | null;
  topCoins: string[];
}

// "Força do setor" — market cap médio ponderado por categoria (L1, DeFi, Memecoin, AI etc).
export async function getCoinCategories(): Promise<CoinCategory[]> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/coins/categories", { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data as Record<string, unknown>[]).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      marketCap: (c.market_cap as number) ?? 0,
      marketCapChangePct24h: (c.market_cap_change_24h ?? null) as number | null,
      topCoins: (c.top_3_coins_id as string[]) ?? [],
    }));
  } catch {
    return [];
  }
}
