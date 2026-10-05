import "server-only";
import { db } from "@/lib/db/client";
import { youtubeVideos } from "@/lib/db/schema";
import { gte } from "drizzle-orm";
import { getCoinMarkets, getCoinCategories, type CoinMarket, type CoinCategory } from "@/lib/sources/coingecko";
import { getFearGreedIndex, type FearGreed } from "@/lib/sources/fearGreed";

export type Conviction = "forte" | "médio" | "fraco";

export interface CryptoIdea {
  title: string;
  detail: string;
  conviction: Conviction;
}

export interface NarrativeMention {
  topic: string;
  count: number;
}

const SIGNAL_THRESHOLD = 2; // pp
const STRONG_THRESHOLD = 6; // pp

function convictionOf(absPct: number): Conviction {
  if (absPct >= STRONG_THRESHOLD) return "forte";
  if (absPct >= SIGNAL_THRESHOLD) return "médio";
  return "fraco";
}

// Termos que aparecem nos títulos dos vídeos que você acompanha (ver youtubeChannels.ts) —
// conta frequência na última semana pra ver qual narrativa está dominando a conversa.
const NARRATIVE_TERMS: { topic: string; pattern: RegExp }[] = [
  { topic: "Altcoin season", pattern: /altcoin season|altseason/i },
  { topic: "ETF", pattern: /\betf\b/i },
  { topic: "Halving", pattern: /halving/i },
  { topic: "DeFi", pattern: /\bdefi\b/i },
  { topic: "Memecoin", pattern: /memecoin|meme coin/i },
  { topic: "Solana", pattern: /solana|\bsol\b/i },
  { topic: "Ethereum", pattern: /ethereum|\beth\b/i },
  { topic: "Stablecoin", pattern: /stablecoin/i },
  { topic: "Regulação/SEC", pattern: /\bsec\b|regulat/i },
  { topic: "Institucional/tesouraria", pattern: /treasury|institutional|microstrategy|etf/i },
  { topic: "Restaking/L2", pattern: /restaking|layer ?2|\bl2\b/i },
  { topic: "AI + cripto", pattern: /\bai\b.*crypto|crypto.*\bai\b/i },
];

async function getWeeklyNarrative(): Promise<NarrativeMention[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(youtubeVideos).where(gte(youtubeVideos.publishedAt, since));

  const counts = new Map<string, number>();
  for (const { topic, pattern } of NARRATIVE_TERMS) {
    const n = rows.filter((r) => pattern.test(r.title)).length;
    if (n > 0) counts.set(topic, n);
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function buildIdeas(
  btc: CoinMarket | null,
  categories: CoinCategory[],
  fearGreed: FearGreed | null,
  narrative: NarrativeMention[]
): CryptoIdea[] {
  const ideas: CryptoIdea[] = [];

  // 1. BTC: tendência diária x semanal consistente
  if (btc && btc.changePct24h !== null && btc.changePct7d !== null) {
    const sameSign = Math.sign(btc.changePct24h) === Math.sign(btc.changePct7d);
    const dir = btc.changePct24h >= 0 ? "alta" : "queda";
    if (sameSign && Math.abs(btc.changePct7d) >= SIGNAL_THRESHOLD) {
      ideas.push({
        title: `BTC em ${dir} consistente (24h e 7d)`,
        detail: `24h ${btc.changePct24h.toFixed(2)}% e 7d ${btc.changePct7d.toFixed(2)}% na mesma direção — tendência de fundo, não só ruído do dia. Altcoins tendem a amplificar esse movimento.`,
        conviction: convictionOf(Math.abs(btc.changePct7d)),
      });
    }
  }

  // 2. Setor mais forte/fraco da semana
  const sorted = [...categories]
    .filter((c) => c.marketCapChangePct24h !== null)
    .sort((a, b) => (b.marketCapChangePct24h ?? 0) - (a.marketCapChangePct24h ?? 0));
  if (sorted.length > 0) {
    const top = sorted[0];
    if (top.marketCapChangePct24h !== null && top.marketCapChangePct24h >= SIGNAL_THRESHOLD) {
      ideas.push({
        title: `Setor em alta: ${top.name} (+${top.marketCapChangePct24h.toFixed(2)}% em 24h)`,
        detail: `Market cap do setor subindo mais que o resto do mercado — força relativa, não é só BTC puxando tudo junto.`,
        conviction: convictionOf(top.marketCapChangePct24h),
      });
    }
    const bottom = sorted[sorted.length - 1];
    if (bottom.marketCapChangePct24h !== null && bottom.marketCapChangePct24h <= -SIGNAL_THRESHOLD) {
      ideas.push({
        title: `Setor em queda: ${bottom.name} (${bottom.marketCapChangePct24h.toFixed(2)}% em 24h)`,
        detail: `Fluxo saindo desse setor mais rápido que o mercado — cautela em posições compradas aqui.`,
        conviction: convictionOf(Math.abs(bottom.marketCapChangePct24h)),
      });
    }
  }

  // 3. Fear & Greed extremo
  if (fearGreed) {
    if (fearGreed.value <= 25) {
      ideas.push({
        title: `Medo extremo (${fearGreed.value}/100) — ${fearGreed.classification}`,
        detail: `Historicamente zona de capitulação — contrários costumam ver como oportunidade, mas pode continuar caindo. Não é sinal de entrada isolado.`,
        conviction: "médio",
      });
    } else if (fearGreed.value >= 75) {
      ideas.push({
        title: `Ganância extrema (${fearGreed.value}/100) — ${fearGreed.classification}`,
        detail: `Historicamente zona de euforia — maior risco de correção abrupta. Bom momento pra revisar tamanho de posição.`,
        conviction: "médio",
      });
    }
  }

  // 4. Narrativa dominante da semana (baseado nos vídeos que você acompanha)
  if (narrative.length > 0 && narrative[0].count >= 3) {
    ideas.push({
      title: `Narrativa da semana: ${narrative[0].topic}`,
      detail: `"${narrative[0].topic}" apareceu em ${narrative[0].count} vídeos dos canais que você segue na última semana — é o que mais está sendo comentado agora.`,
      conviction: narrative[0].count >= 6 ? "forte" : "médio",
    });
  }

  const order: Record<Conviction, number> = { forte: 0, médio: 1, fraco: 2 };
  return ideas.sort((a, b) => order[a.conviction] - order[b.conviction]);
}

const TRACKED_COINS = [
  "bitcoin",
  "ethereum",
  "solana",
  "chainlink",
  "hyperliquid",
  "ripple",
  "cardano",
  "avalanche-2",
  "dogecoin",
  "sui",
];

export interface CryptoEntrada {
  title: string;
  detail: string;
  conviction: Conviction;
  score: number;
}

const ENTRADA_SIGNAL_THRESHOLD = 1.5; // pp de força relativa vs BTC
const ENTRADA_STRONG_THRESHOLD = 5;

function entradaConvictionOf(absScore: number): Conviction {
  if (absScore >= ENTRADA_STRONG_THRESHOLD) return "forte";
  if (absScore >= ENTRADA_SIGNAL_THRESHOLD) return "médio";
  return "fraco";
}

// "Melhores oportunidades": força relativa de cada altcoin contra o BTC (não contra USD) —
// mesma lógica do par EUR/USD no forex, só que a "moeda base" aqui é sempre BTC. Isola o
// movimento específico da moeda/altcoin do movimento geral do mercado (que seria só "tudo sobe
// porque BTC subiu").
function buildEntradas(btc: CoinMarket | null, coins: CoinMarket[]): CryptoEntrada[] {
  if (!btc || btc.changePct24h === null || btc.changePct7d === null) return [];

  const entradas: CryptoEntrada[] = [];
  for (const c of coins) {
    if (c.id === "bitcoin" || c.changePct24h === null || c.changePct7d === null) continue;
    const rel24h = c.changePct24h - btc.changePct24h;
    const rel7d = c.changePct7d - btc.changePct7d;
    const score = 0.4 * rel24h + 0.6 * rel7d;
    if (Math.abs(score) < ENTRADA_SIGNAL_THRESHOLD) continue;

    const long = score > 0;
    const trendConsistent = Math.sign(rel24h) === Math.sign(rel7d) && Math.abs(rel24h) > 0.5 && Math.abs(rel7d) > 0.5;
    entradas.push({
      title: `${long ? "Compra" : "Venda"} ${c.symbol} / ${long ? "Venda" : "Compra"} BTC`,
      detail: `Força relativa vs BTC: 24h ${rel24h >= 0 ? "+" : ""}${rel24h.toFixed(2)}pp, 7d ${rel7d >= 0 ? "+" : ""}${rel7d.toFixed(2)}pp${trendConsistent ? " (consistente nos dois prazos)" : ""}. ${c.symbol} ${long ? "performando melhor" : "performando pior"} que BTC — isola o movimento do ativo em si, não o mercado geral subindo/caindo junto.`,
      conviction: entradaConvictionOf(Math.abs(score)),
      score: Math.abs(score),
    });
  }

  return entradas.sort((a, b) => b.score - a.score).slice(0, 6);
}

export async function getCryptoBoard(): Promise<{
  coins: CoinMarket[];
  categories: CoinCategory[];
  fearGreed: FearGreed | null;
  narrative: NarrativeMention[];
  ideas: CryptoIdea[];
  entradas: CryptoEntrada[];
}> {
  const [coins, categories, fearGreed, narrative] = await Promise.all([
    getCoinMarkets(TRACKED_COINS),
    getCoinCategories(),
    getFearGreedIndex(),
    getWeeklyNarrative(),
  ]);

  const btc = coins.find((c) => c.id === "bitcoin") ?? null;
  const MIN_CATEGORY_MARKET_CAP = 3_000_000_000; // abaixo disso a % de 24h vira ruído (base minúscula)
  const topCategories = categories
    .filter((c) => !/stablecoin/i.test(c.name) && c.marketCap >= MIN_CATEGORY_MARKET_CAP)
    .sort((a, b) => (b.marketCapChangePct24h ?? 0) - (a.marketCapChangePct24h ?? 0))
    .slice(0, 10);

  const ideas = buildIdeas(btc, topCategories, fearGreed, narrative);
  const entradas = buildEntradas(btc, coins);

  return { coins, categories: topCategories, fearGreed, narrative, ideas, entradas };
}
