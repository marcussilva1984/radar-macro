import "server-only";
import { db } from "@/lib/db/client";
import { flowSeries, ideaSnapshots } from "@/lib/db/schema";
import { and, eq, isNull, lte, desc } from "drizzle-orm";
import { getForexBoard } from "@/lib/forex";

const EVAL_AFTER_DAYS = 7;

// Guarda um snapshot de cada par com sinal definido (não "estabilização"), pra depois checar
// se a direção realmente se confirmou — só assim a heurística vira histórico, não achismo.
export async function snapshotIdeas(): Promise<number> {
  const { signals, ideas } = await getForexBoard();
  const convictionByPair = new Map(ideas.map((i) => [i.pairs[0], i.conviction]));

  const rows = signals
    .filter((s) => s.signal !== "estabilização" && s.changePct !== null)
    .map((s) => ({
      pair: s.pair,
      signal: s.signal,
      conviction: convictionByPair.get(s.pair) ?? "fraco",
      score: s.score,
      // close "atual" reconstruído a partir do último changePct não está disponível aqui;
      // usamos o próprio changePct acumulado como base 100 (índice), simples e suficiente
      // pra medir variação percentual entre snapshot e avaliação.
      closeAtSnapshot: 100 * (1 + (s.changePct ?? 0) / 100),
    }));

  if (rows.length === 0) return 0;
  await db.insert(ideaSnapshots).values(rows);
  return rows.length;
}

// Avalia snapshots com >= 7 dias: busca a variação acumulada do par desde então e compara
// com a direção prevista.
export async function evaluateIdeas(): Promise<number> {
  const cutoff = new Date(Date.now() - EVAL_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const pending = await db
    .select()
    .from(ideaSnapshots)
    .where(and(isNull(ideaSnapshots.evaluatedAt), lte(ideaSnapshots.createdAt, cutoff)));

  let evaluated = 0;
  for (const snap of pending) {
    const recent = await db
      .select()
      .from(flowSeries)
      .where(eq(flowSeries.symbol, snap.pair))
      .orderBy(desc(flowSeries.date))
      .limit(EVAL_AFTER_DAYS + 2);

    // Soma os changePct diários desde o snapshot como proxy de variação acumulada do par.
    const sinceSnapshot = recent.filter((r) => r.date >= snap.createdAt && r.changePct !== null);
    if (sinceSnapshot.length === 0) continue;

    const actualChangePct = sinceSnapshot.reduce((acc, r) => acc + (r.changePct ?? 0), 0);
    const outcome =
      (snap.signal === "alta" && actualChangePct > 0) || (snap.signal === "queda" && actualChangePct < 0)
        ? "acerto"
        : "erro";

    await db
      .update(ideaSnapshots)
      .set({ outcome, actualChangePct, evaluatedAt: new Date() })
      .where(eq(ideaSnapshots.id, snap.id));
    evaluated++;
  }
  return evaluated;
}

export interface TrackRecordStats {
  totalEvaluated: number;
  hits: number;
  hitRatePct: number | null;
  byConviction: Record<string, { total: number; hits: number }>;
}

export async function getTrackRecordStats(): Promise<TrackRecordStats> {
  const rows = await db
    .select({ outcome: ideaSnapshots.outcome, conviction: ideaSnapshots.conviction })
    .from(ideaSnapshots);
  return computeStats(rows);
}

function computeStats(rows: Array<{ outcome: string | null; conviction: string }>): TrackRecordStats {
  const done = rows.filter((r) => r.outcome !== null);
  const hits = done.filter((r) => r.outcome === "acerto").length;
  const byConviction: Record<string, { total: number; hits: number }> = {};
  for (const r of done) {
    const b = byConviction[r.conviction] ?? { total: 0, hits: 0 };
    b.total++;
    if (r.outcome === "acerto") b.hits++;
    byConviction[r.conviction] = b;
  }
  return {
    totalEvaluated: done.length,
    hits,
    hitRatePct: done.length > 0 ? (hits / done.length) * 100 : null,
    byConviction,
  };
}
