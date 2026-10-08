import "server-only";

interface YahooChartResult {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: { quote: Array<{ close: (number | null)[] }> };
    }> | null;
    error: unknown;
  };
}

// Fecha diário via endpoint não-oficial do Yahoo Finance (sem chave), mesma técnica
// usada no Terminal de Mercado para preços/índices/forex.
export async function fetchDailyCloses(
  yahooSymbol: string,
  rangeDays = 5
): Promise<Array<{ date: Date; close: number }>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?range=${rangeDays}d&interval=1d`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; radar-macro/0.1)" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Yahoo Finance ${yahooSymbol}: HTTP ${res.status}`);

  const data = (await res.json()) as YahooChartResult;
  const result = data.chart.result?.[0];
  if (!result) throw new Error(`Yahoo Finance ${yahooSymbol}: sem dados`);

  const closes = result.indicators.quote[0].close;
  return result.timestamp
    .map((ts, i) => ({ date: new Date(ts * 1000), close: closes[i] }))
    .filter((p): p is { date: Date; close: number } => p.close != null);
}

interface YahooMetaResult {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
        regularMarketTime?: number;
      };
    }> | null;
  };
}

export interface LiveQuote {
  price: number;
  changePct: number;
}

// Cotação "ao vivo" (delay natural da fonte gratuita, sem chave) via o campo meta do próprio
// endpoint de chart — não precisa de um endpoint de quote separado.
export async function fetchLiveQuote(yahooSymbol: string): Promise<LiveQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=5m`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; radar-macro/0.1)" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooMetaResult;
    const meta = data.chart.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice === undefined) return null;
    return { price: meta.regularMarketPrice, changePct: meta.regularMarketChangePercent ?? 0 };
  } catch {
    return null;
  }
}
