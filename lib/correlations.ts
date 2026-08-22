import "server-only";
import { db } from "@/lib/db/client";
import { flowSeries } from "@/lib/db/schema";
import { gte } from "drizzle-orm";
import { FLOW_SYMBOLS } from "@/lib/sources/flowSymbols";
import { pearsonCorrelation } from "@/lib/stats";

export interface CorrelationShift {
  a: string;
  b: string;
  corr7d: number | null;
  corr30d: number | null;
  shift: number | null; // |corr7d - corr30d|, quanto maior mais a relação "de sempre" quebrou essa semana
}

// Correlação par-a-par entre os ativos de fluxo, 7d vs 30d. Uma correlação historicamente
// estável (30d) que diverge na janela curta (7d) é sinal de narrativa nova/rotação de fluxo.
export async function getCorrelationShifts(): Promise<CorrelationShift[]> {
  const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(flowSeries)
    .where(gte(flowSeries.date, since))
    .orderBy(flowSeries.date);

  const bySymbol = new Map<string, Array<{ date: string; changePct: number }>>();
  for (const r of rows) {
    if (r.changePct === null) continue;
    const list = bySymbol.get(r.symbol) ?? [];
    list.push({ date: r.date.toDateString(), changePct: r.changePct });
    bySymbol.set(r.symbol, list);
  }

  const symbols = FLOW_SYMBOLS.map((s) => s.symbol);
  const results: CorrelationShift[] = [];

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const a = bySymbol.get(symbols[i]) ?? [];
      const b = bySymbol.get(symbols[j]) ?? [];
      // Alinha por data em comum (pregões podem não bater 1:1 entre classes de ativo).
      const datesB = new Set(b.map((x) => x.date));
      const aligned = a.filter((x) => datesB.has(x.date));
      const bByDate = new Map(b.map((x) => [x.date, x.changePct]));
      const seriesA = aligned.map((x) => x.changePct);
      const seriesB = aligned.map((x) => bByDate.get(x.date)!);

      const corr30d = pearsonCorrelation(seriesA, seriesB);
      const corr7d = pearsonCorrelation(seriesA.slice(-7), seriesB.slice(-7));

      results.push({
        a: symbols[i],
        b: symbols[j],
        corr7d,
        corr30d,
        shift: corr7d !== null && corr30d !== null ? Math.abs(corr7d - corr30d) : null,
      });
    }
  }

  return results.sort((x, y) => (y.shift ?? 0) - (x.shift ?? 0));
}
