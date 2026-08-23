import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { macroEvents } from "@/lib/db/schema";
import { EVENT_FEEDS, fetchFeed, tagFromTitle, isCentralBankRelevant } from "@/lib/sources/rssEvents";
import { sendTelegramMessage } from "@/lib/telegram";
import { gte, desc } from "drizzle-orm";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: Record<string, number | string> = {};

  for (const feedDef of EVENT_FEEDS) {
    try {
      const items = await fetchFeed(feedDef.url);
      let inserted = 0;
      for (const item of items) {
        if (!item.link) continue;
        const tags = tagFromTitle(item.title);
        // Fase 1: no feed de geopolítica global, só grava se bater alguma keyword relevante;
        // no feed do Fed, ignora ações regulatórias contra bancos específicos (ruído).
        if (feedDef.category === "geopolitics" && tags.length === 0) continue;
        if (feedDef.category === "central_bank" && !isCentralBankRelevant(item.title)) continue;

        await db
          .insert(macroEvents)
          .values({
            category: feedDef.category,
            country: feedDef.country,
            title: item.title,
            sourceUrl: item.link,
            sourceName: feedDef.sourceName,
            tags,
            publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
          })
          .onConflictDoNothing({ target: macroEvents.sourceUrl });
        inserted++;
      }
      results[feedDef.sourceName] = inserted;
    } catch (err) {
      results[feedDef.sourceName] = `erro: ${(err as Error).message}`;
    }
  }

  // Evento mais importante do dia (Fed/fala de banco central sempre em primeiro, depois
  // geopolítica por nº de tags) — este cron roda 1x/dia, então não precisa de dedup extra.
  let telegramSent = false;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todaysEvents = await db
      .select()
      .from(macroEvents)
      .where(gte(macroEvents.publishedAt, since))
      .orderBy(desc(macroEvents.publishedAt));

    const top =
      todaysEvents.find((e) => e.category === "central_bank") ??
      [...todaysEvents].sort((a, b) => b.tags.length - a.tags.length)[0];

    if (top) {
      await sendTelegramMessage(
        `<b>Evento mais importante do dia (EUA/mercado)</b>\n\n${top.title}\n\n${top.sourceUrl ?? ""}`
      );
      telegramSent = true;
    }
  } catch {
    // best-effort — não quebra a ingestão se o Telegram falhar
  }

  return NextResponse.json({ ok: true, results, telegramSent });
}
