import "server-only";
import { db } from "@/lib/db/client";
import { brokerBalances, carteiraSettings } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { brMidnight, brToday } from "@/lib/brTime";

export const DEFAULT_MONTHLY_GOAL_PCT = 2;

export async function getMonthlyGoalPct(): Promise<number> {
  const rows = await db.select().from(carteiraSettings).where(eq(carteiraSettings.id, 1)).limit(1);
  return rows[0]?.monthlyGoalPct ?? DEFAULT_MONTHLY_GOAL_PCT;
}

export async function setMonthlyGoalPct(pct: number): Promise<void> {
  await db
    .insert(carteiraSettings)
    .values({ id: 1, monthlyGoalPct: pct, updatedAt: new Date() })
    .onConflictDoUpdate({ target: carteiraSettings.id, set: { monthlyGoalPct: pct, updatedAt: new Date() } });
}

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
function computePeriod(entries: BalanceEntry[], cutoff: Date): (PeriodStats & { baselineBalance: number }) | null {
  if (entries.length === 0) return null;
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
  return { profit, profitPct: (profit / base) * 100, deposits, withdrawals, baselineBalance: baseline.balance };
}

// Uma leitura da tabela por request (React cache) — a página da Carteira chamava 3 funções
// que liam a tabela inteira cada uma.
const loadBalancesAsc = cache(async (): Promise<BalanceEntry[]> =>
  db.select().from(brokerBalances).orderBy(asc(brokerBalances.entryDate))
);

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

// days: 1 a 365, escolhido por você na página (evita ter uma coluna fixa por janela).
export async function getBrokerSummaries(days: number): Promise<BrokerSummary[]> {
  const rows = await loadBalancesAsc();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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
      period: computePeriod(entries, cutoff),
      sinceLastUpdate: computeSinceLastUpdate(entries),
    };
  });
}

// Todos os lançamentos de todas as corretoras, mais recente primeiro — o "extrato" de quando
// cada depósito/retirada/atualização de saldo foi feita.
export async function getAllEntries(): Promise<BalanceEntry[]> {
  return [...(await loadBalancesAsc())].reverse();
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
  // Mês de calendário em Brasília: baseline = último lançamento antes da meia-noite do dia 1
  // (antes era "últimos N dias a partir de agora", que no dia 1 pegava o fim do mês anterior).
  const today = brToday();
  const monthStart = brMidnight(today.year, today.month, 1);

  const rows = await loadBalancesAsc();
  let totalProfit = 0;
  let totalBase = 0;
  let hasAny = false;

  for (const broker of BROKERS) {
    const entries = rows.filter((r) => r.broker === broker);
    const period = computePeriod(entries, monthStart);
    if (period) {
      totalProfit += period.profit;
      totalBase += period.baselineBalance;
      hasAny = true;
    }
  }

  if (!hasAny) return null;
  return { profit: totalProfit, baseBalance: totalBase, daysElapsed: today.day, daysInMonth: today.daysInMonth };
}
