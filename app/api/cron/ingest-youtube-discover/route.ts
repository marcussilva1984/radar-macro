import { NextResponse } from "next/server";
import { searchRecentVideos, fetchVideoDurationsMinutes, fetchMySubscriptions } from "@/lib/sources/youtube";
import { isYoutubeConnected, getAuthenticatedClient } from "@/lib/sources/googleAuth";
import { YOUTUBE_SEARCH_TOPICS, isRelevantTitle } from "@/lib/sources/youtubeChannels";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  MIN_DURATION_MINUTES,
  insertVideosReturningNew,
  sendVideoTelegramDigest,
  type VideoWithSubscription,
} from "@/lib/videoIngestShared";
import type { YoutubeVideoHit } from "@/lib/sources/youtube";

export const maxDuration = 60;

// Descoberta por tema (busca vídeos relevantes em QUALQUER canal, mesmo os que você não
// segue) — cara em cota (search.list = 100 unid/tema, ~800/rodada), por isso roda só 2x/dia,
// diferente do check de inscrições (barato, 8x/dia em /api/cron/ingest-youtube).
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

  let followedIds = new Set<string>();
  try {
    const subs = await fetchMySubscriptions(client);
    followedIds = new Set(subs.map((s) => s.channelId));
  } catch {
    // se falhar, segue sem saber quem é seguido — trata tudo como "não seguido"
  }

  const topicResults = await mapWithConcurrency(YOUTUBE_SEARCH_TOPICS, 4, async (topic) => {
    try {
      const allVideos = await searchRecentVideos(client, topic);
      const videos = allVideos.filter((v) => isRelevantTitle(v.title, v.channelTitle));
      return { topic, videos };
    } catch (err) {
      return { topic, error: (err as Error).message, videos: [] as YoutubeVideoHit[] };
    }
  });

  const allVideos: YoutubeVideoHit[] = [];
  for (const r of topicResults) {
    if ("error" in r) results[`topic:${r.topic}`] = `erro: ${r.error}`;
    else results[`topic:${r.topic}`] = r.videos.length;
    allVideos.push(...r.videos);
  }

  const durations = await fetchVideoDurationsMinutes(client, [...new Set(allVideos.map((v) => v.videoId))]);
  const longEnough = allVideos.filter(
    (v) => (durations.get(v.videoId) ?? MIN_DURATION_MINUTES) >= MIN_DURATION_MINUTES
  );

  const newlyInserted = await insertVideosReturningNew(longEnough, (v) => ({
    subscribed: followedIds.has(v.channelId),
    matchedTags: [],
  }));
  const withSub: VideoWithSubscription[] = newlyInserted.map((v) => ({
    ...v,
    subscribed: followedIds.has(v.channelId),
  }));
  const telegramMessagesSent = await sendVideoTelegramDigest(withSub);

  return NextResponse.json({ ok: true, results, newVideos: newlyInserted.length, telegramMessagesSent });
}
