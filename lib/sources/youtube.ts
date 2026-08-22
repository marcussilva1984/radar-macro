import "server-only";

interface YoutubeSearchItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
}

interface YoutubeSearchResponse {
  items: YoutubeSearchItem[];
  error?: { message: string };
}

export interface YoutubeVideoHit {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: Date;
}

const API_BASE = "https://www.googleapis.com/youtube/v3";

function requireApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY não configurada — veja .env.example");
  return key;
}

// Busca vídeos publicados nas últimas `hours` horas que casam com um termo de busca.
// Usa a Data API v3 com chave simples (sem OAuth) — não lê inscrições reais do usuário.
export async function searchRecentVideos(query: string, hours = 48): Promise<YoutubeVideoHit[]> {
  const key = requireApiKey();
  const publishedAfter = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("publishedAfter", publishedAfter);
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const data = (await res.json()) as YoutubeSearchResponse;
  if (!res.ok) throw new Error(`YouTube API: ${data.error?.message ?? res.status}`);

  return data.items
    .filter((it) => it.id.videoId)
    .map((it) => ({
      videoId: it.id.videoId!,
      channelId: it.snippet.channelId,
      channelTitle: it.snippet.channelTitle,
      title: it.snippet.title,
      publishedAt: new Date(it.snippet.publishedAt),
    }));
}

// Últimos vídeos de um canal específico (canais que você segue, da lista manual).
export async function fetchChannelRecentVideos(channelId: string, hours = 48): Promise<YoutubeVideoHit[]> {
  const key = requireApiKey();
  const publishedAfter = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("publishedAfter", publishedAfter);
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const data = (await res.json()) as YoutubeSearchResponse;
  if (!res.ok) throw new Error(`YouTube API: ${data.error?.message ?? res.status}`);

  return data.items
    .filter((it) => it.id.videoId)
    .map((it) => ({
      videoId: it.id.videoId!,
      channelId: it.snippet.channelId,
      channelTitle: it.snippet.channelTitle,
      title: it.snippet.title,
      publishedAt: new Date(it.snippet.publishedAt),
    }));
}
