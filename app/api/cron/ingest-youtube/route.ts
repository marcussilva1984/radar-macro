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
import { YOUTUBE_SEARCH_TOPICS } from "@/lib/sources/youtubeChannels";
import { mapWithConcurrency } from "@/lib/concurrency";

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

  // 1. Vídeos novos de todos os canais que você realmente segue (subscriptions.list).
  let followedIds = new Set<string>();
  try {
    const subs = await fetchMySubscriptions(client);
    followedIds = new Set(subs.map((s) => s.channelId));
    const videos = await fetchRecentVideosFromSubscriptions(client, subs);
    const inserted = await insertVideos(videos, { subscribed: true });
    results["subscriptions"] = `${subs.length} canais, ${inserted} vídeos novos`;
  } catch (err) {
    results["subscriptions"] = `erro: ${(err as Error).message}`;
  }

  // 2. Vídeos relevantes por tema, de qualquer canal (alerta de "não segue mas pode interessar").
  // Em paralelo (limitado) — vários temas em sequência facilmente estoura o timeout de 60s.
  const topicResults = await mapWithConcurrency(YOUTUBE_SEARCH_TOPICS, 4, async (topic) => {
    try {
      const videos = await searchRecentVideos(client, topic);
      const inserted = await insertVideos(videos, (v) => ({
        subscribed: followedIds.has(v.channelId),
        matchedTags: [topic],
      }));
      return { topic, inserted };
    } catch (err) {
      return { topic, error: (err as Error).message };
    }
  });

  for (const r of topicResults) {
    results[`topic:${r.topic}`] = "error" in r ? `erro: ${r.error}` : r.inserted;
  }

  return NextResponse.json({ ok: true, results });
}
