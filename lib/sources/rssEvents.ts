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
    sourceName: "bcb-notas",
    url: "https://www.bcb.gov.br/api/feed/sitebcb/notasimprensa",
    category: "central_bank",
    country: "BR",
  },
  {
    sourceName: "reuters-world",
    url: "https://feeds.reuters.com/Reuters/worldNews",
    category: "geopolitics",
    country: "GLOBAL",
  },
];

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

export function tagFromTitle(title: string): string[] {
  const lower = title.toLowerCase();
  return GEOPOLITICS_KEYWORDS.filter((kw) => lower.includes(kw));
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
