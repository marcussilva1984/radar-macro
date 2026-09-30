import "server-only";
import { db } from "@/lib/db/client";
import { brokerBalances } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const BROKERS = ["EBC", "AXI", "ICMarkets", "FBS"] as const;
export type Broker = (typeof BROKERS)[number];

export interface BalanceEntry {
  id: number;
  broker: string;
  entryDate: Date;
  balance: number;
  deposit: number;
  withdrawal: number;
}

export interface BrokerSummary {
  broker: string;
  currentBalance: number | null;
  lastEntryDate: Date | null;
  profit7d: number | null;
  profitPct7d: number | null;
  profit15d: number | null;
  profitPct15d: number | null;
  profit30d: number | null;
  profitPct30d: number | null;
}

// Lucro de um período = variação do saldo, descontando aportes e somando de volta saques —
// senão um depósito grande pareceria "lucro" e um saque pareceria "prejuízo".
function computeProfit(entries: BalanceEntry[], sinceDays: number): { profit: number; pct: number } | null {
  if (entries.length === 0) return null;
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const last = entries[entries.length - 1];

  // Baseline: a última entrada ANTES do corte (se não houver, usa a mais antiga disponível —
  // janela parcial, melhor que nada quando o histórico é curto).
  const before = entries.filter((e) => e.entryDate <= cutoff);
  const baseline = before.length > 0 ? before[before.length - 1] : entries[0];
  if (baseline.id === last.id) return null; // só uma entrada, sem período pra comparar

  const between = entries.filter((e) => e.entryDate > baseline.entryDate && e.entryDate <= last.entryDate);
  const netFlows = between.reduce((acc, e) => acc + e.deposit - e.withdrawal, 0);
  const profit = last.balance - baseline.balance - netFlows;
  const base = baseline.balance || 1;
  return { profit, pct: (profit / base) * 100 };
}

export async function getBrokerSummaries(): Promise<BrokerSummary[]> {
  const rows = await db.select().from(brokerBalances).orderBy(asc(brokerBalances.entryDate));

  return BROKERS.map((broker) => {
    const entries = rows.filter((r) => r.broker === broker);
    if (entries.length === 0) {
      return {
        broker,
        currentBalance: null,
        lastEntryDate: null,
        profit7d: null,
        profitPct7d: null,
        profit15d: null,
        profitPct15d: null,
        profit30d: null,
        profitPct30d: null,
      };
    }
    const last = entries[entries.length - 1];
    const p7 = computeProfit(entries, 7);
    const p15 = computeProfit(entries, 15);
    const p30 = computeProfit(entries, 30);
    return {
      broker,
      currentBalance: last.balance,
      lastEntryDate: last.entryDate,
      profit7d: p7?.profit ?? null,
      profitPct7d: p7?.pct ?? null,
      profit15d: p15?.profit ?? null,
      profitPct15d: p15?.pct ?? null,
      profit30d: p30?.profit ?? null,
      profitPct30d: p30?.pct ?? null,
    };
  });
}

export async function getHistory(broker: string): Promise<BalanceEntry[]> {
  return db
    .select()
    .from(brokerBalances)
    .where(eq(brokerBalances.broker, broker))
    .orderBy(asc(brokerBalances.entryDate));
}

export async function addBalanceEntry(input: {
  broker: string;
  entryDate: Date;
  balance: number;
  deposit: number;
  withdrawal: number;
}): Promise<void> {
  await db
    .insert(brokerBalances)
    .values(input)
    .onConflictDoUpdate({
      target: [brokerBalances.broker, brokerBalances.entryDate],
      set: { balance: input.balance, deposit: input.deposit, withdrawal: input.withdrawal },
    });
}
