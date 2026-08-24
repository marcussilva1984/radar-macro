import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { youtubeVideos } from "@/lib/db/schema";
import {
  fetchMySubscriptions,
  fetchRecentVideosFromSubscriptions,
  searchRecentVideos,
  type YoutubeVideoHit,
} from "@/lib/sources/youtube";
import { isYoutubeConnected, getAuthenticatedClient } from "@/lib/sources/googleAuth";
import { YOUTUBE_SEARCH_TOPICS, isRelevantTitle } from "@/lib/sources/youtubeChannels";
import { mapWithConcurrency } from "@/lib/concurrency";
import { classifyVideoImportance } from "@/lib/videos";
import { sendTelegramMessage } from "@/lib/telegram";

export const maxDuration = 60;

async function insertVideos(
  videos: YoutubeVideoHit[],
  opts: { subscribed: boolean; matchedTags?: string[] } | ((v: YoutubeVideoHit) => { subscribed: boolean; matchedTags: string[] })
) {
  if (videos.length === 0) return 0;
  const rows = videos.map((v) => {
    const o = typeof opts === "function" ? opts(v) : opts;
    return {
      videoId: v.videoId,
      channelId: v.channelId,
      channelTitle: v.channelTitle,
      title: v.title,
      matchedTags: o.matchedTags ?? [],
      subscribed: o.subscribed,
      publishedAt: v.publishedAt,
    };
  });
  await db.insert(youtubeVideos).values(rows).onConflictDoNothing({ target: youtubeVideos.videoId });
  return rows.length;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await isYoutubeConnected())) {
    return NextResponse.json({ skipped: "YouTube não conectado — acesse /api/auth/youtube" });
  }

  const client = await getAuthenticatedClient();
  const results: Record<string, number | string> = {};
  const allRelevantVideos: YoutubeVideoHit[] = [];

  // 1. Vídeos novos de todos os canais que você realmente segue (subscriptions.list).
  let followedIds = new Set<string>();
  try {
    const subs = await fetchMySubscriptions(client);
    followedIds = new Set(subs.map((s) => s.channelId));
    const allVideos = await fetchRecentVideosFromSubscriptions(client, subs);
    // Com centenas de inscrições, sem esse filtro a lista vira "tudo que você assiste"
    // (futebol, vlog, etc) em vez de só o que interessa ao Radar Macro.
    const videos = allVideos.filter((v) => isRelevantTitle(v.title, v.channelTitle));
    const inserted = await insertVideos(videos, { subscribed: true });
    allRelevantVideos.push(...videos);
    results["subscriptions"] = `${subs.length} canais, ${allVideos.length} vídeos, ${inserted} relevantes`;
  } catch (err) {
    results["subscriptions"] = `erro: ${(err as Error).message}`;
  }

  // 2. Vídeos relevantes por tema, de qualquer canal (alerta de "não segue mas pode interessar").
  // Em paralelo (limitado) — vários temas em sequência facilmente estoura o timeout de 60s.
  const topicResults = await mapWithConcurrency(YOUTUBE_SEARCH_TOPICS, 4, async (topic) => {
    try {
      const allVideos = await searchRecentVideos(client, topic);
      const videos = allVideos.filter((v) => isRelevantTitle(v.title, v.channelTitle));
      const inserted = await insertVideos(videos, (v) => ({
        subscribed: followedIds.has(v.channelId),
        matchedTags: [topic],
      }));
      return { topic, inserted, videos };
    } catch (err) {
      return { topic, error: (err as Error).message, videos: [] as YoutubeVideoHit[] };
    }
  });

  for (const r of topicResults) {
    results[`topic:${r.topic}`] = "error" in r ? `erro: ${r.error}` : r.inserted;
    allRelevantVideos.push(...r.videos);
  }

  // Alerta no Telegram com todos os vídeos relevantes, agrupados por cor de convicção — não
  // pré-filtramos, você decide o que importa. Limita por nível pra não virar spam.
  let telegramSent = false;
  try {
    const seen = new Set<string>();
    const unique = allRelevantVideos.filter((v) => {
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });

    const EMOJI = { forte: "🔴", médio: "🟡", fraco: "🔵" } as const;
    const LIMIT = { forte: 8, médio: 5, fraco: 3 } as const;
    const sections: string[] = [];

    for (const level of ["forte", "médio", "fraco"] as const) {
      const videos = unique.filter((v) => classifyVideoImportance(v.title) === level).slice(0, LIMIT[level]);
      if (videos.length === 0) continue;
      const lines = videos.map(
        (v) => `${EMOJI[level]} <b>${v.title}</b>\n${v.channelTitle} — https://www.youtube.com/watch?v=${v.videoId}`
      );
      sections.push(`<b>${level.toUpperCase()}</b>\n\n${lines.join("\n\n")}`);
    }

    if (sections.length > 0) {
      await sendTelegramMessage(`<b>Vídeos relevantes hoje</b>\n\n${sections.join("\n\n———\n\n")}`);
      telegramSent = true;
    }
  } catch {
    // best-effort — não quebra a ingestão se o Telegram falhar
  }

  return NextResponse.json({ ok: true, results, telegramSent });
}
