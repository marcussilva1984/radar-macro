import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { youtubeVideos } from "@/lib/db/schema";
import {
  fetchMySubscriptions,
  fetchRecentVideosFromSubscriptions,
  searchRecentVideos,
  fetchVideoDurationsMinutes,
  type YoutubeVideoHit,
} from "@/lib/sources/youtube";
import { isYoutubeConnected, getAuthenticatedClient } from "@/lib/sources/googleAuth";
import { YOUTUBE_SEARCH_TOPICS, isRelevantTitle } from "@/lib/sources/youtubeChannels";
import { mapWithConcurrency } from "@/lib/concurrency";
import { classifyVideoImportance } from "@/lib/videos";
import { sendTelegramMessage } from "@/lib/telegram";

export const maxDuration = 60;

const MIN_DURATION_MINUTES = 20;

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
  let subVideos: YoutubeVideoHit[] = [];
  try {
    const subs = await fetchMySubscriptions(client);
    followedIds = new Set(subs.map((s) => s.channelId));
    const allVideos = await fetchRecentVideosFromSubscriptions(client, subs);
    // Com centenas de inscrições, sem esse filtro a lista vira "tudo que você assiste"
    // (futebol, vlog, etc) em vez de só o que interessa ao Radar Macro.
    subVideos = allVideos.filter((v) => isRelevantTitle(v.title, v.channelTitle));
    results["subscriptions"] = `${subs.length} canais, ${allVideos.length} vídeos, ${subVideos.length} relevantes (antes do filtro de duração)`;
  } catch (err) {
    results["subscriptions"] = `erro: ${(err as Error).message}`;
  }

  // 2. Vídeos relevantes por tema, de qualquer canal (alerta de "não segue mas pode interessar").
  // Em paralelo (limitado) — vários temas em sequência facilmente estoura o timeout de 60s.
  const topicResults = await mapWithConcurrency(YOUTUBE_SEARCH_TOPICS, 4, async (topic) => {
    try {
      const allVideos = await searchRecentVideos(client, topic);
      const videos = allVideos.filter((v) => isRelevantTitle(v.title, v.channelTitle));
      return { topic, videos };
    } catch (err) {
      return { topic, error: (err as Error).message, videos: [] as YoutubeVideoHit[] };
    }
  });

  const topicVideosByTopic = new Map<string, YoutubeVideoHit[]>();
  for (const r of topicResults) {
    if ("error" in r) results[`topic:${r.topic}`] = `erro: ${r.error}`;
    topicVideosByTopic.set(r.topic, r.videos);
  }

  // Filtro de duração (>= 20min, tira Shorts e clipes curtos) — videos.list em lote de 50,
  // ~1 unidade de cota por lote, então cabe fácil no orçamento mesmo com centenas de vídeos.
  const allTopicVideos = [...topicVideosByTopic.values()].flat();
  const allCandidateIds = [...subVideos, ...allTopicVideos].map((v) => v.videoId);
  let durations = new Map<string, number>();
  try {
    durations = await fetchVideoDurationsMinutes(client, [...new Set(allCandidateIds)]);
  } catch (err) {
    results["durations"] = `erro: ${(err as Error).message}`;
  }
  const longEnough = (v: YoutubeVideoHit) => (durations.get(v.videoId) ?? MIN_DURATION_MINUTES) >= MIN_DURATION_MINUTES;

  const subVideosFiltered = subVideos.filter(longEnough);
  const insertedSub = await insertVideos(subVideosFiltered, { subscribed: true });
  results["subscriptions"] = `${results["subscriptions"]}, ${insertedSub} com >= ${MIN_DURATION_MINUTES}min`;

  const allRelevantVideos: YoutubeVideoHit[] = [...subVideosFiltered];
  for (const [topic, videos] of topicVideosByTopic) {
    const filtered = videos.filter(longEnough);
    const inserted = await insertVideos(filtered, (v) => ({
      subscribed: followedIds.has(v.channelId),
      matchedTags: [topic],
    }));
    results[`topic:${topic}`] = inserted;
    allRelevantVideos.push(...filtered);
  }

  // Alerta no Telegram só com FORTE e MÉDIO (fraco fica de fora, mas ainda aparece no site
  // em /videos) — reduz volume de mensagem, embora não afete a cota de ingestão em si (essa
  // é limitada pelas chamadas de busca, não pelo que é enviado). Telegram limita ~4096 char
  // por mensagem, então quebra em várias mensagens quando precisa.
  let telegramMessagesSent = 0;
  try {
    const seen = new Set<string>();
    const unique = allRelevantVideos.filter((v) => {
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });

    const EMOJI = { forte: "🔴", médio: "🟡" } as const;
    const lines: string[] = [];
    for (const level of ["forte", "médio"] as const) {
      const videos = unique.filter((v) => classifyVideoImportance(v.title) === level);
      if (videos.length === 0) continue;
      lines.push(`<b>${level.toUpperCase()} (${videos.length})</b>`);
      for (const v of videos) {
        lines.push(`${EMOJI[level]} <b>${v.title}</b>\n${v.channelTitle} — https://www.youtube.com/watch?v=${v.videoId}`);
      }
    }

    if (lines.length > 0) {
      const MAX_CHARS = 3800; // margem de segurança sob o limite de 4096 do Telegram
      const chunks: string[] = [];
      let current = "";
      for (const line of lines) {
        const candidate = current ? `${current}\n\n${line}` : line;
        if (candidate.length > MAX_CHARS && current) {
          chunks.push(current);
          current = line;
        } else {
          current = candidate;
        }
      }
      if (current) chunks.push(current);

      for (let i = 0; i < chunks.length; i++) {
        const header = chunks.length > 1 ? `<b>Vídeos relevantes hoje (${i + 1}/${chunks.length})</b>\n\n` : `<b>Vídeos relevantes hoje</b>\n\n`;
        await sendTelegramMessage(header + chunks[i]);
        telegramMessagesSent++;
      }
    }
  } catch {
    // best-effort — não quebra a ingestão se o Telegram falhar
  }

  return NextResponse.json({ ok: true, results, telegramMessagesSent });
}
