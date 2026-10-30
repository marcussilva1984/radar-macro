import { NextResponse } from "next/server";
import { getCryptoBoard } from "@/lib/cryptoBoard";
import { sendTelegramMessage } from "@/lib/telegram";

export const maxDuration = 30;

// Roda 1x/dia — manda só as ideias FORTE do board de Cripto (mesma lógica já usada na página),
// pra avisar de setor/BTC em movimento extremo sem precisar abrir o site. Sem dedup: como é
// 1x/dia, não tem risco de virar spam repetido no mesmo dia.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let sent = false;
  try {
    const board = await getCryptoBoard();
    const strong = board.ideas.filter((i) => i.conviction === "forte");
    if (strong.length > 0) {
      const lines = strong.map((i) => `🔴 <b>${i.title}</b>\n${i.detail}`);
      await sendTelegramMessage(`<b>Radar Macro — alertas fortes de Cripto hoje</b>\n\n${lines.join("\n\n")}`);
      sent = true;
    }
    return NextResponse.json({ ok: true, sent, strongCount: strong.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
