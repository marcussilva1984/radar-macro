import { NextResponse } from "next/server";
import { updateBalanceEntry, deleteBalanceEntry } from "@/lib/brokerPortfolio";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });

  const { entryDate, balance, deposit, withdrawal } = body;
  const balanceNum = Number(balance);
  if (!entryDate || Number.isNaN(balanceNum)) {
    return NextResponse.json({ error: "data ou saldo inválido" }, { status: 400 });
  }

  await updateBalanceEntry(idNum, {
    entryDate: new Date(`${entryDate}T12:00:00Z`),
    balance: balanceNum,
    deposit: Number(deposit) || 0,
    withdrawal: Number(withdrawal) || 0,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  await deleteBalanceEntry(idNum);
  return NextResponse.json({ ok: true });
}
