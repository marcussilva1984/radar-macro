import "server-only";
import type { YoutubeVideoHit } from "@/lib/sources/youtube";

// Feed RSS público do YouTube por canal — grátis, não consome cota da API. Só dá os ~15
// vídeos mais recentes (sem duração, sem paginação), mas é de graça pra descobrir vídeos
// novos de canais que já conhecemos (ver SEED_CRYPTO_CHANNELS).
function parseEntries(xml: string): { videoId: string; title: string; channelTitle: string; publishedAt: Date }[] {
  const entries: { videoId: string; title: string; channelTitle: string; publishedAt: Date }[] = [];
  const entryBlocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const block of entryBlocks) {
    const videoId = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const title = block.match(/<title>(.*?)<\/title>/)?.[1];
    const channelTitle = block.match(/<name>(.*?)<\/name>/)?.[1];
    const published = block.match(/<published>(.*?)<\/published>/)?.[1];
    if (!videoId || !title || !channelTitle || !published) continue;
    entries.push({
      videoId,
      title: decodeXmlEntities(title),
      channelTitle: decodeXmlEntities(channelTitle),
      publishedAt: new Date(published),
    });
  }
  return entries;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function fetchChannelRssVideos(channelId: string): Promise<YoutubeVideoHit[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseEntries(xml).map((e) => ({ ...e, channelId }));
}
