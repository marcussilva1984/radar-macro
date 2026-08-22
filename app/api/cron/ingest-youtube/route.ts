import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { youtubeVideos } from "@/lib/db/schema";
import {
  fetchMySubscriptions,
  fetchRecentVideosFromSubscriptions,
  searchRecentVideos,
} from "@/lib/sources/youtube";
import { isYoutubeConnected, getAuthenticatedClient } from "@/lib/sources/googleAuth";
import { YOUTUBE_SEARCH_TOPICS } from "@/lib/sources/youtubeChannels";

export const maxDuration = 60;

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
    let inserted = 0;
    for (const v of videos) {
      await db
        .insert(youtubeVideos)
        .values({
          videoId: v.videoId,
          channelId: v.channelId,
          channelTitle: v.channelTitle,
          title: v.title,
          matchedTags: [],
          subscribed: true,
          publishedAt: v.publishedAt,
        })
        .onConflictDoNothing({ target: youtubeVideos.videoId });
      inserted++;
    }
    results["subscriptions"] = `${subs.length} canais, ${inserted} vídeos novos`;
  } catch (err) {
    results["subscriptions"] = `erro: ${(err as Error).message}`;
  }

  // 2. Vídeos relevantes por tema, de qualquer canal (alerta de "não segue mas pode interessar").
  for (const topic of YOUTUBE_SEARCH_TOPICS) {
    try {
      const videos = await searchRecentVideos(client, topic);
      let inserted = 0;
      for (const v of videos) {
        await db
          .insert(youtubeVideos)
          .values({
            videoId: v.videoId,
            channelId: v.channelId,
            channelTitle: v.channelTitle,
            title: v.title,
            matchedTags: [topic],
            subscribed: followedIds.has(v.channelId),
            publishedAt: v.publishedAt,
          })
          .onConflictDoNothing({ target: youtubeVideos.videoId });
        inserted++;
      }
      results[`topic:${topic}`] = inserted;
    } catch (err) {
      results[`topic:${topic}`] = `erro: ${(err as Error).message}`;
    }
  }

  return NextResponse.json({ ok: true, results });
}
