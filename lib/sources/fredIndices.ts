import "server-only";

// FRED (Fed St. Louis) publica CSV público sem chave pra várias séries — usamos aqui pro
// Broad Dollar Index, que pesa o dólar contra uma cesta bem mais ampla (inclui emergentes)
// do que o DXY, que é dominado por EUR (~58%) e JPY (~14%).
export const FRED_INDICES = [
  { symbol: "DXY_BROAD", seriesId: "DTWEXBGS", label: "Dólar Amplo (Fed, cesta ampla)" },
] as const;

export async function fetchFredSeries(
  seriesId: string,
  days = 15
): Promise<Array<{ date: Date; close: number }>> {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`FRED ${seriesId}: HTTP ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split("\n").slice(1); // pula header "DATE,<seriesId>"
  const points = lines
    .map((line) => {
      const [dateStr, valueStr] = line.split(",");
      const value = Number(valueStr);
      if (!dateStr || Number.isNaN(value)) return null;
      return { date: new Date(`${dateStr}T12:00:00Z`), close: value };
    })
    .filter((p): p is { date: Date; close: number } => p !== null);

  return points.slice(-days);
}
