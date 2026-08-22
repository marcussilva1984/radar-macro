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
