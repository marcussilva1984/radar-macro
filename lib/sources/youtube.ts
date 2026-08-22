import "server-only";
import { google, youtube_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export interface YoutubeVideoHit {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: Date;
}

export interface SubscribedChannel {
  channelId: string;
  channelTitle: string;
}

function yt(auth: OAuth2Client): youtube_v3.Youtube {
  return google.youtube({ version: "v3", auth });
}

// Sua lista real de inscrições (via OAuth) — substitui a lista manual da Fase 1.
export async function fetchMySubscriptions(auth: OAuth2Client): Promise<SubscribedChannel[]> {
  const client = yt(auth);
  const channels: SubscribedChannel[] = [];
  let pageToken: string | undefined;

  do {
    const res = await client.subscriptions.list({
      part: ["snippet"],
      mine: true,
      maxResults: 50,
      pageToken,
    });
    for (const item of res.data.items ?? []) {
      const channelId = item.snippet?.resourceId?.channelId;
      const channelTitle = item.snippet?.title;
      if (channelId && channelTitle) channels.push({ channelId, channelTitle });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return channels;
}

// channels.list aceita até 50 ids por chamada — bem mais barato de quota que 1 search.list por canal.
async function fetchUploadsPlaylistIds(
  auth: OAuth2Client,
  channelIds: string[]
): Promise<Map<string, string>> {
  const client = yt(auth);
  const map = new Map<string, string>();

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const res = await client.channels.list({ part: ["contentDetails"], id: batch, maxResults: 50 });
    for (const item of res.data.items ?? []) {
      const uploads = item.contentDetails?.relatedPlaylists?.uploads;
      if (item.id && uploads) map.set(item.id, uploads);
    }
  }

  return map;
}

// Vídeos recentes de todos os canais que você segue, via playlist de uploads (barato em quota).
export async function fetchRecentVideosFromSubscriptions(
  auth: OAuth2Client,
  channels: SubscribedChannel[],
  hours = 48
): Promise<YoutubeVideoHit[]> {
  const client = yt(auth);
  const uploadsByChannel = await fetchUploadsPlaylistIds(
    auth,
    channels.map((c) => c.channelId)
  );
  const since = Date.now() - hours * 60 * 60 * 1000;
  const titleByChannel = new Map(channels.map((c) => [c.channelId, c.channelTitle]));
  const hits: YoutubeVideoHit[] = [];

  for (const [channelId, playlistId] of uploadsByChannel) {
    try {
      const res = await client.playlistItems.list({
        part: ["snippet"],
        playlistId,
        maxResults: 5,
      });
      for (const item of res.data.items ?? []) {
        const publishedAt = item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null;
        const videoId = item.snippet?.resourceId?.videoId;
        if (!publishedAt || !videoId || publishedAt.getTime() < since) continue;
        hits.push({
          videoId,
          channelId,
          channelTitle: titleByChannel.get(channelId) ?? item.snippet?.channelTitle ?? "",
          title: item.snippet?.title ?? "(sem título)",
          publishedAt,
        });
      }
    } catch {
      // canal pode ter uploads privados/desativados — ignora e segue os demais
    }
  }

  return hits;
}

// Busca por tema, pra achar vídeos relevantes mesmo em canais que você não segue.
export async function searchRecentVideos(
  auth: OAuth2Client,
  query: string,
  hours = 48
): Promise<YoutubeVideoHit[]> {
  const client = yt(auth);
  const publishedAfter = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const res = await client.search.list({
    part: ["snippet"],
    q: query,
    type: ["video"],
    order: "date",
    publishedAfter,
    maxResults: 10,
  });

  return (res.data.items ?? [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id!.videoId!,
      channelId: it.snippet?.channelId ?? "",
      channelTitle: it.snippet?.channelTitle ?? "",
      title: it.snippet?.title ?? "(sem título)",
      publishedAt: it.snippet?.publishedAt ? new Date(it.snippet.publishedAt) : new Date(),
    }));
}
