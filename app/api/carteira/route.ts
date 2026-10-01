import { NextResponse } from "next/server";
import { addBalanceEntry, getSinceLastUpdateForBroker, BROKERS } from "@/lib/brokerPortfolio";
import { sendTelegramMessage } from "@/lib/telegram";

// Dispara alerta se o lucro desde a última atualização cair abaixo disso (%).
const DRAWDOWN_ALERT_PCT = -5;

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

  const sinceLastUpdate = await getSinceLastUpdateForBroker(broker);
  if (sinceLastUpdate && sinceLastUpdate.profitPct <= DRAWDOWN_ALERT_PCT) {
    const sign = sinceLastUpdate.profit >= 0 ? "+" : "";
    await sendTelegramMessage(
      `⚠️ <b>Drawdown na Carteira — ${broker}</b>\n` +
        `${sign}$${sinceLastUpdate.profit.toFixed(2)} (${sinceLastUpdate.profitPct.toFixed(1)}%) ` +
        `em ${sinceLastUpdate.days} dia${sinceLastUpdate.days > 1 ? "s" : ""}`
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
