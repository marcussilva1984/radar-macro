import { getRecentVideos } from "@/lib/videos";
import { isYoutubeConnected } from "@/lib/sources/googleAuth";
import type { Conviction } from "@/lib/forex";

export const dynamic = "force-dynamic";

// Mesmo esquema de cor do Forex: forte = vermelho, médio = amarelo, fraco = azul.
const CONVICTION_BADGE: Record<Conviction, string> = {
  forte: "bg-red-600 text-white",
  médio: "bg-yellow-500 text-black",
  fraco: "bg-blue-500 text-white",
};
const CONVICTION_BORDER: Record<Conviction, string> = {
  forte: "border-red-300 dark:border-red-900",
  médio: "border-yellow-300 dark:border-yellow-900",
  fraco: "border-zinc-200 dark:border-zinc-800",
};

function VideoRow({
  v,
}: {
  v: { videoId: string; channelTitle: string; title: string; publishedAt: Date; conviction: Conviction };
}) {
  return (
    <li
      className={`rounded border bg-white p-3 dark:bg-zinc-950 ${CONVICTION_BORDER[v.conviction]}`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${CONVICTION_BADGE[v.conviction]}`}
        >
          {v.conviction}
        </span>
        <a
          href={`https://www.youtube.com/watch?v=${v.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-black hover:underline dark:text-zinc-50"
        >
          {v.title}
        </a>
      </div>
      <div className="mt-1 pl-[46px] text-xs text-zinc-500">
        {v.channelTitle} · {v.publishedAt.toLocaleString("pt-BR")}
      </div>
    </li>
  );
}

export default async function VideosPage() {
  let followed: Awaited<ReturnType<typeof getRecentVideos>>["followed"] = [];
  let discovered: Awaited<ReturnType<typeof getRecentVideos>>["discovered"] = [];
  let error: string | null = null;
  let connected = false;

  try {
    connected = await isYoutubeConnected();
    ({ followed, discovered } = await getRecentVideos());
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Vídeos</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Vídeos novos dos canais que você realmente segue (via login com Google) + alerta de
        vídeos relevantes de canais que você não segue, sobre os temas do Radar Macro
        (internacional e nacional). Ordenados por grau de importância do assunto — mesmas cores
        da aba Forex.
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Configure <code>DATABASE_URL</code>. ({error})
        </div>
      )}

      {!error && !connected && (
        <div className="mt-6 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <p>YouTube ainda não conectado.</p>
          <a
            href="/api/auth/youtube"
            className="mt-2 inline-block rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Conectar com Google
          </a>
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
