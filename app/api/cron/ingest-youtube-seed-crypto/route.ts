import { NextResponse } from "next/server";
import { fetchChannelRssVideos } from "@/lib/sources/youtubeRss";
import { fetchVideoDurationsMinutes, fetchMySubscriptions } from "@/lib/sources/youtube";
import { isYoutubeConnected, getAuthenticatedClient } from "@/lib/sources/googleAuth";
import { SEED_CRYPTO_CHANNELS, isRelevantTitle } from "@/lib/sources/youtubeChannels";
import {
  MIN_DURATION_MINUTES,
  insertVideosReturningNew,
  sendVideoTelegramDigest,
  type VideoWithSubscription,
} from "@/lib/videoIngestShared";
import type { YoutubeVideoHit } from "@/lib/sources/youtube";

export const maxDuration = 60;

// Ingestão via RSS (grátis, sem cota de search.list) de canais de cripto/altcoins já
// conhecidos (SEED_CRYPTO_CHANNELS) — complementa a descoberta por tema, que é cara em cota
// e só roda 2x/dia. Só o batch de duração (videos.list) usa a API, e é barato (~1 unidade a
// cada 50 vídeos).
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rssResults = await Promise.allSettled(SEED_CRYPTO_CHANNELS.map((c) => fetchChannelRssVideos(c.channelId)));
  const allVideos: YoutubeVideoHit[] = [];
  for (const r of rssResults) {
    if (r.status === "fulfilled") allVideos.push(...r.value);
  }
  const relevant = allVideos.filter((v) => isRelevantTitle(v.title, v.channelTitle));

  if (!(await isYoutubeConnected())) {
    // sem OAuth não dá pra checar duração — insere sem o filtro de 30min pra não perder tudo
    const newlyInserted = await insertVideosReturningNew(relevant, { subscribed: false, matchedTags: [] });
    const sent = await sendVideoTelegramDigest(newlyInserted.map((v) => ({ ...v, subscribed: false })));
    return NextResponse.json({ ok: true, found: relevant.length, newVideos: newlyInserted.length, telegramMessagesSent: sent, durationChecked: false });
  }

  let client: Awaited<ReturnType<typeof getAuthenticatedClient>>;
  try {
    client = await getAuthenticatedClient();
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }

  let followedIds = new Set<string>();
  try {
    const subs = await fetchMySubscriptions(client);
    followedIds = new Set(subs.map((s) => s.channelId));
  } catch {
    // segue sem saber quem é seguido
  }

  const durations = await fetchVideoDurationsMinutes(client, [...new Set(relevant.map((v) => v.videoId))]);
  const longEnough = relevant.filter((v) => (durations.get(v.videoId) ?? MIN_DURATION_MINUTES) >= MIN_DURATION_MINUTES);

  const newlyInserted = await insertVideosReturningNew(longEnough, (v) => ({
    subscribed: followedIds.has(v.channelId),
    matchedTags: [],
  }));
  const withSub: VideoWithSubscription[] = newlyInserted.map((v) => ({ ...v, subscribed: followedIds.has(v.channelId) }));
  const telegramMessagesSent = await sendVideoTelegramDigest(withSub);

  return NextResponse.json({ ok: true, found: relevant.length, newVideos: newlyInserted.length, telegramMessagesSent, durationChecked: true });
}
