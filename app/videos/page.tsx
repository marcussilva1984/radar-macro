import { getRecentVideos } from "@/lib/videos";
import { FOLLOWED_CHANNELS } from "@/lib/sources/youtubeChannels";

function VideoRow({ v }: { v: { videoId: string; channelTitle: string; title: string; publishedAt: Date } }) {
  return (
    <li className="rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <a
        href={`https://www.youtube.com/watch?v=${v.videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-black hover:underline dark:text-zinc-50"
      >
        {v.title}
      </a>
      <div className="mt-1 text-xs text-zinc-500">
        {v.channelTitle} · {v.publishedAt.toLocaleString("pt-BR")}
      </div>
    </li>
  );
}

export default async function VideosPage() {
  let followed: Awaited<ReturnType<typeof getRecentVideos>>["followed"] = [];
  let discovered: Awaited<ReturnType<typeof getRecentVideos>>["discovered"] = [];
  let error: string | null = null;

  try {
    ({ followed, discovered } = await getRecentVideos());
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Vídeos</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Sem OAuth não lemos suas inscrições reais do YouTube — edite{" "}
        <code>lib/sources/youtubeChannels.ts</code> com os canais que você segue. Os demais
        vídeos aqui vêm de busca por tema (bancos centrais, geopolítica, etc), mesmo de canais
        que você não segue.
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Configure <code>DATABASE_URL</code> e <code>YOUTUBE_API_KEY</code>. ({error})
        </div>
      )}

      {!error && FOLLOWED_CHANNELS.length === 0 && (
        <div className="mt-6 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          Nenhum canal cadastrado ainda em <code>lib/sources/youtubeChannels.ts</code>.
        </div>
      )}

      {!error && (
        <>
          <h2 className="mt-8 text-lg font-medium text-black dark:text-zinc-50">
            Canais que você segue
          </h2>
          <ul className="mt-3 space-y-2">
            {followed.map((v) => (
              <VideoRow key={v.videoId} v={v} />
            ))}
            {followed.length === 0 && (
              <p className="text-sm text-zinc-500">Nenhum vídeo novo nos últimos 7 dias.</p>
            )}
          </ul>

          <h2 className="mt-10 text-lg font-medium text-black dark:text-zinc-50">
            Alerta: relevante, mas você não segue
          </h2>
          <ul className="mt-3 space-y-2">
            {discovered.map((v) => (
              <VideoRow key={v.videoId} v={v} />
            ))}
            {discovered.length === 0 && (
              <p className="text-sm text-zinc-500">Nenhum vídeo encontrado nos últimos 7 dias.</p>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
