import { getFlowMap } from "@/lib/flowMap";
import { getTrackRecordStats } from "@/lib/trackRecord";

export const dynamic = "force-dynamic";

function formatClose(label: string, value: number): string {
  const formatted = value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (label.includes("yield")) return `${formatted}%`;
  return formatted;
}

export default async function FluxoPage() {
  let nodes: Awaited<ReturnType<typeof getFlowMap>> = [];
  let track: Awaited<ReturnType<typeof getTrackRecordStats>> | null = null;
  let error: string | null = null;

  try {
    [nodes, track] = await Promise.all([getFlowMap(), getTrackRecordStats()]);
  } catch (e) {
    error = (e as Error).message;
  }

  const maxAbs = Math.max(0.01, ...nodes.map((n) => Math.abs(n.weeklyChangePct)));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Mapa de Fluxo</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Pra onde o dinheiro migrou na semana — moedas, ouro, prata, cobre, commodities (DBC),
        treasuries, BTC, S&amp;P, Dólar (DXY) e Dólar Amplo (Fed) na mesma régua de comparação,
        do que mais subiu ao que mais caiu. DXY é dominado por EUR/JPY (~72%); o Dólar Amplo usa
        uma cesta bem maior (Fed, inclui emergentes) — compare os dois quando divergirem.
      </p>

      {error && (
        <div className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}

      {!error && (
        <ul className="mt-8 space-y-2">
          {nodes.map((n) => {
            const pct = (Math.abs(n.weeklyChangePct) / maxAbs) * 50; // até 50% da largura pra cada lado
            const positive = n.weeklyChangePct >= 0;
            return (
              <li key={n.label} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {n.label}
                  {n.latestClose !== null && (
                    <span className="block text-[10px] text-zinc-400">
                      {formatClose(n.label, n.latestClose)}
                    </span>
                  )}
                </span>
                <div className="relative h-5 flex-1 rounded bg-zinc-100 dark:bg-zinc-900">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-zinc-300 dark:bg-zinc-700" />
                  <div
                    className={
                      positive
                        ? "absolute top-0 h-full rounded bg-green-500"
                        : "absolute top-0 h-full rounded bg-red-500"
                    }
                    style={
                      positive
                        ? { left: "50%", width: `${pct}%` }
                        : { right: "50%", width: `${pct}%` }
                    }
                  />
                </div>
                <span
                  className={`w-16 shrink-0 text-xs ${
                    positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {n.weeklyChangePct >= 0 ? "+" : ""}
                  {n.weeklyChangePct.toFixed(2)}%
                </span>
                <span className="w-14 shrink-0 text-xs text-zinc-400">{n.group}</span>
              </li>
            );
          })}
          {nodes.length === 0 && (
            <p className="text-sm text-zinc-500">
              Sem dados suficientes ainda — rode os crons de ingestão por alguns dias.
            </p>
          )}
        </ul>
      )}

      {track && track.totalEvaluated > 0 && (
        <div className="mt-10 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500">
            Track record das ideias de Forex (avaliadas 7 dias depois de geradas)
          </p>
          <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">
            {track.hitRatePct?.toFixed(0)}% de acerto ({track.hits}/{track.totalEvaluated})
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
            {Object.entries(track.byConviction).map(([conviction, s]) => (
              <span key={conviction}>
                {conviction}: {s.hits}/{s.total} (
                {s.total > 0 ? ((s.hits / s.total) * 100).toFixed(0) : 0}%)
              </span>
            ))}
          </div>
        </div>
      )}
      {track && track.totalEvaluated === 0 && (
        <p className="mt-10 text-xs text-zinc-500">
          Track record ainda sem ideias avaliadas — a primeira leva de snapshots leva ~7 dias
          pra ter resultado (cron <code>/api/cron/track-record</code>).
        </p>
      )}
    </div>
  );
}
