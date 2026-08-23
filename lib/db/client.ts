import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __radarMacroSql: ReturnType<typeof postgres> | undefined;
}

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não configurada — veja .env.example");
  }
  if (!global.__radarMacroSql) {
    // prepare:false é obrigatório no modo transaction do pooler do Supabase (PgBouncer não
    // suporta prepared statements entre conexões) — sem isso, queries falham de forma
    // intermitente e confusa dependendo de qual conexão do pool atende a query.
    global.__radarMacroSql = postgres(url, { max: 3, prepare: false });
  }
  return global.__radarMacroSql;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;
let cached: Db | undefined;

function getDb(): Db {
  if (!cached) cached = drizzle(getClient(), { schema });
  return cached;
}

// Proxy: só toca DATABASE_URL/conexão quando uma query é de fato executada,
// não na hora do import (evita 500 em build/SSR quando o env ainda não está setado).
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
