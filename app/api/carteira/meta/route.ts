import { NextResponse } from "next/server";
import { setMonthlyGoalPct } from "@/lib/brokerPortfolio";
import { requestIsCarteiraAuthorized } from "@/lib/carteiraAuth";

export async function POST(req: Request) {
  if (!(await requestIsCarteiraAuthorized())) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const pct = Number(body?.monthlyGoalPct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return NextResponse.json({ error: "meta inválida (0 a 100%)" }, { status: 400 });
  }
  await setMonthlyGoalPct(pct);
  return NextResponse.json({ ok: true });
}
