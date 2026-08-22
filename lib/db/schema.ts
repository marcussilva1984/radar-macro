import { pgTable, serial, text, timestamp, doublePrecision, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

// Eventos: decisões/falas de bancos centrais, geopolítica, dados macro.
export const macroEvents = pgTable(
  "macro_events",
  {
    id: serial("id").primaryKey(),
    category: text("category").notNull(), // 'central_bank' | 'geopolitics' | 'macro_data'
    country: text("country").notNull(), // 'US' | 'BR' | 'EU' | 'UK' | 'AU' | 'NZ' | 'CH' | 'CN' | 'GLOBAL'
    title: text("title").notNull(),
    sourceUrl: text("source_url"),
    sourceName: text("source_name").notNull(), // ex: 'federalreserve.gov', 'reuters-world-rss'
    tags: text("tags").array().notNull().default([]), // ex: ['juros','tarifa','opep']
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("macro_events_published_at_idx").on(t.publishedAt),
    index("macro_events_category_idx").on(t.category),
    uniqueIndex("macro_events_source_url_idx").on(t.sourceUrl),
  ]
);

// Série diária de "força relativa" por ativo de fluxo (DXY, ouro, treasuries, BTC, S&P, etc).
export const flowSeries = pgTable(
  "flow_series",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(), // ex: 'DXY', 'GOLD', 'US10Y', 'BTC', 'SPX'
    date: timestamp("date", { withTimezone: true }).notNull(),
    close: doublePrecision("close").notNull(),
    changePct: doublePrecision("change_pct"), // variação vs. fechamento anterior
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("flow_series_symbol_date_idx").on(t.symbol, t.date),
    uniqueIndex("flow_series_symbol_date_unique").on(t.symbol, t.date),
  ]
);

// Vídeos do YouTube relevantes aos temas rastreados (busca por keyword, sem OAuth).
export const youtubeVideos = pgTable(
  "youtube_videos",
  {
    id: serial("id").primaryKey(),
    videoId: text("video_id").notNull(),
    channelId: text("channel_id").notNull(),
    channelTitle: text("channel_title").notNull(),
    title: text("title").notNull(),
    matchedTags: text("matched_tags").array().notNull().default([]),
    subscribed: boolean("subscribed").notNull().default(false), // canal está na sua lista (lib/sources/youtubeChannels.ts)
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("youtube_videos_published_at_idx").on(t.publishedAt),
    uniqueIndex("youtube_videos_video_id_idx").on(t.videoId),
  ]
);

// Resumo semanal gerado (Fase 1: texto simples a partir dos eventos de maior "surpresa").
export const weeklySummaries = pgTable(
  "weekly_summaries",
  {
    id: serial("id").primaryKey(),
    weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weekly_summaries_week_start_idx").on(t.weekStart)]
);
