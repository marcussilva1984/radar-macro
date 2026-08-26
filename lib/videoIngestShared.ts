import "server-only";
import { db } from "@/lib/db/client";
import { youtubeVideos } from "@/lib/db/schema";
import type { YoutubeVideoHit } from "@/lib/sources/youtube";
import { classifyVideoImportance } from "@/lib/videos";
import { sendTelegramMessage } from "@/lib/telegram";

export const MIN_DURATION_MINUTES = 30;

// Insere e devolve só os vídeos REALMENTE novos (via RETURNING) — sem isso, um vídeo já
// visto em uma rodada anterior (dentro da janela de 48h de busca) seria alertado de novo no
// Telegram a cada rodada do dia, virando spam repetido do mesmo conteúdo.
export async function insertVideosReturningNew(
  videos: YoutubeVideoHit[],
  opts: { subscribed: boolean; matchedTags?: string[] } | ((v: YoutubeVideoHit) => { subscribed: boolean; matchedTags: string[] })
): Promise<YoutubeVideoHit[]> {
  if (videos.length === 0) return [];
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
  const inserted = await db
    .insert(youtubeVideos)
    .values(rows)
    .onConflictDoNothing({ target: youtubeVideos.videoId })
    .returning({ videoId: youtubeVideos.videoId });
  const newIds = new Set(inserted.map((r) => r.videoId));
  return videos.filter((v) => newIds.has(v.videoId));
}

export interface VideoWithSubscription extends YoutubeVideoHit {
  subscribed: boolean;
}

// Manda um alerta no Telegram só com FORTE e MÉDIO (fraco fica de fora, mas ainda aparece no
// site em /videos). Marca "👀 não seguido" pros vídeos de canais que você não segue ainda —
// pra você decidir se quer se inscrever. Telegram limita ~4096 char/mensagem, quebra em várias.
export async function sendVideoTelegramDigest(videos: VideoWithSubscription[]): Promise<number> {
  const seen = new Set<string>();
  const unique = videos.filter((v) => {
    if (seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });

  const EMOJI = { forte: "🔴", médio: "🟡" } as const;
  const lines: string[] = [];
  for (const level of ["forte", "médio"] as const) {
    const levelVideos = unique.filter((v) => classifyVideoImportance(v.title) === level);
    if (levelVideos.length === 0) continue;
    lines.push(`<b>${level.toUpperCase()} (${levelVideos.length})</b>`);
    for (const v of levelVideos) {
      const tag = v.subscribed ? "" : " 👀 não seguido";
      lines.push(`${EMOJI[level]} <b>${v.title}</b>${tag}\n${v.channelTitle} — https://www.youtube.com/watch?v=${v.videoId}`);
    }
  }

  if (lines.length === 0) return 0;

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

  let sent = 0;
  for (let i = 0; i < chunks.length; i++) {
    const header = chunks.length > 1 ? `<b>Vídeos novos (${i + 1}/${chunks.length})</b>\n\n` : `<b>Vídeos novos</b>\n\n`;
    await sendTelegramMessage(header + chunks[i]);
    sent++;
  }
  return sent;
}
