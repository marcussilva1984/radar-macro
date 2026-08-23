import { NextResponse } from "next/server";
import { saveWeeklySummary } from "@/lib/weeklySummary";
import { getForexBoard } from "@/lib/forex";
import { sendTelegramMessage } from "@/lib/telegram";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await saveWeeklySummary();

    let telegramSent = false;
    try {
      const { ideas } = await getForexBoard();
      const strong = ideas.filter((i) => i.conviction === "forte");
      if (strong.length > 0) {
        const lines = strong.map((i) => `🔴 <b>${i.title}</b>\n${i.detail}`);
        await sendTelegramMessage(
          `<b>Radar Macro — ideias fortes da semana</b>\n\n${lines.join("\n\n")}`
        );
        telegramSent = true;
      }
    } catch {
      // Telegram é best-effort — não quebra o resumo semanal se falhar.
    }

    return NextResponse.json({ ok: true, summary, telegramSent });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
