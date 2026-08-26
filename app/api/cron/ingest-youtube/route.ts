import { NextResponse } from "next/server";
import {
  fetchMySubscriptions,
  fetchRecentVideosFromSubscriptions,
  fetchVideoDurationsMinutes,
} from "@/lib/sources/youtube";
import { isYoutubeConnected, getAuthenticatedClient } from "@/lib/sources/googleAuth";
import { isRelevantTitle } from "@/lib/sources/youtubeChannels";
import {
  MIN_DURATION_MINUTES,
  insertVideosReturningNew,
  sendVideoTelegramDigest,
  type VideoWithSubscription,
} from "@/lib/videoIngestShared";

export const maxDuration = 60;

// Canais que você segue de verdade (subscriptions.list) — barato em cota (~980 unidades),
// por isso roda com mais frequência (8x/dia) que a descoberta por tema (2x/dia, mais cara).
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

  try {
    const subs = await fetchMySubscriptions(client);
    const allVideos = await fetchRecentVideosFromSubscriptions(client, subs);
    // Com centenas de inscrições, sem esse filtro a lista vira "tudo que você assiste"
    // (futebol, vlog, etc) em vez de só o que interessa ao Radar Macro.
    const relevant = allVideos.filter((v) => isRelevantTitle(v.title, v.channelTitle));

    const durations = await fetchVideoDurationsMinutes(client, [...new Set(relevant.map((v) => v.videoId))]);
    const longEnough = relevant.filter(
      (v) => (durations.get(v.videoId) ?? MIN_DURATION_MINUTES) >= MIN_DURATION_MINUTES
    );

    const newlyInserted = await insertVideosReturningNew(longEnough, { subscribed: true });
    const withSub: VideoWithSubscription[] = newlyInserted.map((v) => ({ ...v, subscribed: true }));
    const telegramMessagesSent = await sendVideoTelegramDigest(withSub);

    results.summary = `${subs.length} canais, ${allVideos.length} vídeos, ${relevant.length} relevantes, ${longEnough.length} com >= ${MIN_DURATION_MINUTES}min, ${newlyInserted.length} novos`;
    return NextResponse.json({ ok: true, results, telegramMessagesSent });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
