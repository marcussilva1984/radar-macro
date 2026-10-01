import { NextResponse } from "next/server";
import { saveWeeklySummary } from "@/lib/weeklySummary";
import { getForexBoard } from "@/lib/forex";
import { sendTelegramMessage } from "@/lib/telegram";
import { getB3Ideas } from "@/lib/b3Ideas";
import { db } from "@/lib/db/client";
import { youtubeVideos } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";

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
          `<b>Radar Macro — ideias fortes da semana (Forex)</b>\n\n${lines.join("\n\n")}`
        );
        telegramSent = true;
      }

      const b3Strong = (await getB3Ideas()).filter((i) => i.conviction === "forte").slice(0, 12);
      if (b3Strong.length > 0) {
        const lines = b3Strong.map((i) => `🔴 <b>${i.title}</b>\n${i.detail}`);
        await sendTelegramMessage(
          `<b>Radar Macro — ideias fortes da semana (Ações e FIIs)</b>\n\n${lines.join("\n\n")}`
        );
        telegramSent = true;
      }
      // Canais novos descobertos na semana — agrega os vídeos "não seguido" (de canais fora
      // da sua lista de inscrições) num bloco só, em vez de você revisar um por um todo dia.
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const discovered = await db
        .select()
        .from(youtubeVideos)
        .where(and(eq(youtubeVideos.subscribed, false), gte(youtubeVideos.publishedAt, weekAgo)));
      if (discovered.length > 0) {
        const byChannel = new Map<string, number>();
        for (const v of discovered) byChannel.set(v.channelTitle, (byChannel.get(v.channelTitle) ?? 0) + 1);
        const lines = [...byChannel.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([channel, count]) => `• ${channel} (${count} vídeo${count > 1 ? "s" : ""})`);
        await sendTelegramMessage(
          `<b>Radar Macro — canais novos descobertos essa semana</b>\n` +
            `${discovered.length} vídeos de ${byChannel.size} canais que você ainda não segue:\n\n${lines.join("\n")}`
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
