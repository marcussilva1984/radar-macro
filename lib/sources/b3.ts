import "server-only";
import * as cheerio from "cheerio";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface B3Asset {
  symbol: string;
  kind: "acao" | "fii";
  close: number;
  changePct: number;
  financialVolume: number; // close * volume (R$ negociados no dia) — filtro de liquidez
}

interface BrapiItem {
  stock: string;
  close: number | null;
  change: number | null;
  volume: number | null;
  subType?: string;
}

async function brapiList(type: "stock" | "fund", limit: number): Promise<BrapiItem[]> {
  const url = `https://brapi.dev/api/quote/list?type=${type}&sortBy=volume&sortOrder=desc&limit=${limit}`;
  // Plano grátis da brapi devolve 429 fácil — uma segunda tentativa após pausa resolve a maioria.
  let res = await fetch(url, { next: { revalidate: 0 } });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 4000));
    res = await fetch(url, { next: { revalidate: 0 } });
  }
  if (!res.ok) throw new Error(`brapi ${type}: HTTP ${res.status}`);
  const data = (await res.json()) as { stocks?: BrapiItem[] };
  return data.stocks ?? [];
}

// Universo líquido da B3: só papéis com volume financeiro mínimo (senão o ranking vira
// ruído de papel que ninguém negocia) — mesma ideia do Terminal de Mercado.
export async function fetchLiquidUniverse(): Promise<B3Asset[]> {
  const stocks = await brapiList("stock", 120);
  const funds = await brapiList("fund", 200);

  const toAsset = (item: BrapiItem, kind: B3Asset["kind"]): B3Asset | null => {
    if (item.close == null || item.change == null || item.volume == null) return null;
    return {
      symbol: item.stock,
      kind,
      close: item.close,
      changePct: item.change,
      financialVolume: item.close * item.volume,
    };
  };

  const acoes = stocks
    .map((s) => toAsset(s, "acao"))
    .filter((a): a is B3Asset => a !== null && a.financialVolume >= 20_000_000)
    .slice(0, 50);
  const fiis = funds
    .filter((f) => f.subType === "fii") // ETFs de índice também vêm como "fund"
    .map((f) => toAsset(f, "fii"))
    .filter((a): a is B3Asset => a !== null && a.financialVolume >= 2_000_000)
    .slice(0, 40);

  return [...acoes, ...fiis];
}

// Dividend yield 12m dos FIIs — tabela server-renderizada do investidor10 (scrape; se o layout
// mudar, lança e quem chama segue sem DY em vez de quebrar tudo).
export async function fetchFiiDividendYields(): Promise<Map<string, number>> {
  const res = await fetch("https://investidor10.com.br/fiis/rankings/maior-dividend-yield/", {
    headers: { "user-agent": BROWSER_UA },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`investidor10: HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const map = new Map<string, number>();
  $("table#rankigns tbody tr").each((_, el) => {
    const href = $(el).find("a[href*='/fiis/']").first().attr("href") ?? "";
    const symbol = href.split("/fiis/")[1]?.replace(/\/$/, "").toUpperCase();
    const dy = parseFloat($(el).find("td").eq(1).text().trim().replace("%", "").replace(",", "."));
    if (symbol && !Number.isNaN(dy)) map.set(symbol, dy);
  });
  if (map.size === 0) throw new Error("tabela de dividend yield não encontrada (layout mudou?)");
  return map;
}
