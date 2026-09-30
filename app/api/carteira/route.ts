import { NextResponse } from "next/server";
import { addBalanceEntry, BROKERS } from "@/lib/brokerPortfolio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });

  const { broker, entryDate, balance, deposit, withdrawal } = body;
  if (!BROKERS.includes(broker)) {
    return NextResponse.json({ error: "corretora inválida" }, { status: 400 });
  }
  const balanceNum = Number(balance);
  if (!entryDate || Number.isNaN(balanceNum)) {
    return NextResponse.json({ error: "data ou saldo inválido" }, { status: 400 });
  }

  await addBalanceEntry({
    broker,
    entryDate: new Date(`${entryDate}T12:00:00Z`),
    balance: balanceNum,
    deposit: Number(deposit) || 0,
    withdrawal: Number(withdrawal) || 0,
  });

  return NextResponse.json({ ok: true });
}
