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

export interface SinceLastUpdateStats extends PeriodStats {
  days: number;
  fromDate: Date;
}

export interface BrokerSummary {
  broker: string;
  currentBalance: number | null;
  lastEntryDate: Date | null;
  period: PeriodStats | null;
  sinceLastUpdate: SinceLastUpdateStats | null;
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

// Lucro entre os dois últimos lançamentos — o que importa quando você não atualiza todo dia:
// não precisa escolher uma janela, é sempre "desde a última vez que você mexeu no saldo".
function computeSinceLastUpdate(entries: BalanceEntry[]): SinceLastUpdateStats | null {
  if (entries.length < 2) return null;
  const last = entries[entries.length - 1];
  const prev = entries[entries.length - 2];
  const profit = last.balance - prev.balance - last.deposit + last.withdrawal;
  const base = prev.balance || 1;
  const days = Math.max(
    1,
    Math.round((last.entryDate.getTime() - prev.entryDate.getTime()) / (24 * 60 * 60 * 1000))
  );
  return {
    profit,
    profitPct: (profit / base) * 100,
    deposits: last.deposit,
    withdrawals: last.withdrawal,
    days,
    fromDate: prev.entryDate,
  };
}

// days: 1 a 30, escolhido por você na página (evita ter uma coluna fixa por janela).
export async function getBrokerSummaries(days: number): Promise<BrokerSummary[]> {
  const rows = await db.select().from(brokerBalances).orderBy(asc(brokerBalances.entryDate));

  return BROKERS.map((broker) => {
    const entries = rows.filter((r) => r.broker === broker);
    if (entries.length === 0) {
      return { broker, currentBalance: null, lastEntryDate: null, period: null, sinceLastUpdate: null };
    }
    const last = entries[entries.length - 1];
    return {
      broker,
      currentBalance: last.balance,
      lastEntryDate: last.entryDate,
      period: computePeriod(entries, days),
      sinceLastUpdate: computeSinceLastUpdate(entries),
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

export async function updateBalanceEntry(
  id: number,
  input: { entryDate: Date; balance: number; deposit: number; withdrawal: number }
): Promise<void> {
  await db
    .update(brokerBalances)
    .set({
      entryDate: input.entryDate,
      balance: input.balance,
      deposit: input.deposit,
      withdrawal: input.withdrawal,
    })
    .where(eq(brokerBalances.id, id));
}

export async function deleteBalanceEntry(id: number): Promise<void> {
  await db.delete(brokerBalances).where(eq(brokerBalances.id, id));
}

// Reusa a mesma lógica de "lucro desde a última atualização" pra decidir se manda alerta de
// drawdown logo depois de um lançamento novo (chamado pela API route, não pela página).
export async function getSinceLastUpdateForBroker(broker: string): Promise<SinceLastUpdateStats | null> {
  const entries = await getHistory(broker);
  return computeSinceLastUpdate(entries);
}

// Lucro do mês corrente (1º dia até hoje), somado entre todas as corretoras — pra comparar com
// a projeção do simulador de meta. "baseBalance" é o saldo-base pra calcular % (mesma convenção
// de totalPeriod na página: saldo atual menos o lucro do período).
export async function getMonthToDateStats(): Promise<{
  profit: number;
  baseBalance: number;
  daysElapsed: number;
  daysInMonth: number;
} | null> {
  const now = new Date();
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const rows = await db.select().from(brokerBalances).orderBy(asc(brokerBalances.entryDate));
  let totalProfit = 0;
  let totalBalance = 0;
  let hasAny = false;

  for (const broker of BROKERS) {
    const entries = rows.filter((r) => r.broker === broker);
    if (entries.length === 0) continue;
    const last = entries[entries.length - 1];
    totalBalance += last.balance;
    const period = computePeriod(entries, daysElapsed);
    if (period) {
      totalProfit += period.profit;
      hasAny = true;
    }
  }

  if (!hasAny) return null;
  return { profit: totalProfit, baseBalance: totalBalance - totalProfit, daysElapsed, daysInMonth };
}
