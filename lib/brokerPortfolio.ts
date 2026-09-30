import "server-only";
import { db } from "@/lib/db/client";
import { brokerBalances } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";

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

export interface PeriodStats {
  profit: number;
  profitPct: number;
  deposits: number;
  withdrawals: number;
}

export interface BrokerSummary {
  broker: string;
  currentBalance: number | null;
  lastEntryDate: Date | null;
  p7: PeriodStats | null;
  p15: PeriodStats | null;
  p30: PeriodStats | null;
}

// Lucro de um período = variação do saldo, descontando aportes e somando de volta saques —
// senão um depósito grande pareceria "lucro" e um saque pareceria "prejuízo". Também devolve
// o total depositado/sacado no período, pra você ver quando fez cada coisa.
function computePeriod(entries: BalanceEntry[], sinceDays: number): PeriodStats | null {
  if (entries.length === 0) return null;
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const last = entries[entries.length - 1];

  // Baseline: a última entrada ANTES do corte (se não houver, usa a mais antiga disponível —
  // janela parcial, melhor que nada quando o histórico é curto).
  const before = entries.filter((e) => e.entryDate <= cutoff);
  const baseline = before.length > 0 ? before[before.length - 1] : entries[0];
  if (baseline.id === last.id) return null; // só uma entrada, sem período pra comparar

  const between = entries.filter((e) => e.entryDate > baseline.entryDate && e.entryDate <= last.entryDate);
  const deposits = between.reduce((acc, e) => acc + e.deposit, 0);
  const withdrawals = between.reduce((acc, e) => acc + e.withdrawal, 0);
  const profit = last.balance - baseline.balance - deposits + withdrawals;
  const base = baseline.balance || 1;
  return { profit, profitPct: (profit / base) * 100, deposits, withdrawals };
}

export async function getBrokerSummaries(): Promise<BrokerSummary[]> {
  const rows = await db.select().from(brokerBalances).orderBy(asc(brokerBalances.entryDate));

  return BROKERS.map((broker) => {
    const entries = rows.filter((r) => r.broker === broker);
    if (entries.length === 0) {
      return { broker, currentBalance: null, lastEntryDate: null, p7: null, p15: null, p30: null };
    }
    const last = entries[entries.length - 1];
    return {
      broker,
      currentBalance: last.balance,
      lastEntryDate: last.entryDate,
      p7: computePeriod(entries, 7),
      p15: computePeriod(entries, 15),
      p30: computePeriod(entries, 30),
    };
  });
}

// Todos os lançamentos de todas as corretoras, mais recente primeiro — o "extrato" de quando
// cada depósito/retirada/atualização de saldo foi feita.
export async function getAllEntries(): Promise<BalanceEntry[]> {
  return db.select().from(brokerBalances).orderBy(desc(brokerBalances.entryDate));
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
