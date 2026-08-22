import "server-only";
import Parser from "rss-parser";

const parser = new Parser();

export interface RawFeedItem {
  title: string;
  link?: string;
  isoDate?: string;
  contentSnippet?: string;
}

// Fontes RSS por categoria/país. Fase 1: cobertura enxuta, dá pra crescer sem mudar schema.
export const EVENT_FEEDS: Array<{
  sourceName: string;
  url: string;
  category: "central_bank" | "geopolitics" | "macro_data";
  country: string;
}> = [
  {
    sourceName: "federalreserve-press",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    category: "central_bank",
    country: "US",
  },
  {
    sourceName: "bbc-world",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    category: "geopolitics",
    country: "GLOBAL",
  },
];

// Fora do MVP por enquanto: BCB não tem RSS público funcional (site é SPA, API retorna 400
// pra RSS) e o feed público da Reuters foi descontinuado — sem contornar bloqueio/paywall.

// Palavras-chave usadas para taguear e para decidir relevância geopolítica.
export const GEOPOLITICS_KEYWORDS = [
  "war",
  "guerra",
  "sanction",
  "sanção",
  "sanções",
  "opec",
  "opep",
  "tariff",
  "tarifa",
  "ceasefire",
  "invasion",
  "conflict",
];

// A maioria dos itens do feed geral do Fed é ação regulatória (enforcement action contra banco
// específico) — ruído pra timeline. Só nos interessa política monetária de fato.
const CENTRAL_BANK_RELEVANT = [
  "fomc",
  "federal open market committee",
  "interest rate",
  "monetary policy",
  "policy statement",
  "beige book",
  "chair powell",
];

export function isCentralBankRelevant(title: string): boolean {
  const lower = title.toLowerCase();
  return CENTRAL_BANK_RELEVANT.some((kw) => lower.includes(kw));
}

export function tagFromTitle(title: string): string[] {
  const lower = title.toLowerCase();
  // \b evita falso positivo tipo "war" casando dentro de "warning".
  return GEOPOLITICS_KEYWORDS.filter((kw) => new RegExp(`\\b${kw}\\b`, "i").test(lower));
}

export async function fetchFeed(url: string): Promise<RawFeedItem[]> {
  const feed = await parser.parseURL(url);
  return (feed.items ?? []).map((item) => ({
    title: item.title ?? "(sem título)",
    link: item.link,
    isoDate: item.isoDate,
    contentSnippet: item.contentSnippet,
  }));
}
