import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { youtubeVideos } from "@/lib/db/schema";
import { fetchChannelRecentVideos, searchRecentVideos } from "@/lib/sources/youtube";
import { FOLLOWED_CHANNELS, YOUTUBE_SEARCH_TOPICS } from "@/lib/sources/youtubeChannels";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ skipped: "YOUTUBE_API_KEY não configurada" });
  }

  const results: Record<string, number | string> = {};

  // 1. Vídeos novos dos canais que você segue (lista manual em youtubeChannels.ts).
  for (const { channelId, label } of FOLLOWED_CHANNELS) {
    try {
      const videos = await fetchChannelRecentVideos(channelId);
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
      results[`channel:${label}`] = inserted;
    } catch (err) {
      results[`channel:${label}`] = `erro: ${(err as Error).message}`;
    }
  }

  // 2. Vídeos relevantes por tema, de qualquer canal (alerta de "você não segue mas pode interessar").
  const followedIds = new Set(FOLLOWED_CHANNELS.map((c) => c.channelId));
  for (const topic of YOUTUBE_SEARCH_TOPICS) {
    try {
      const videos = await searchRecentVideos(topic);
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
