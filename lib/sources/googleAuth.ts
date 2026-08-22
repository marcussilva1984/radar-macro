import "server-only";
import { google } from "googleapis";
import { db } from "@/lib/db/client";
import { youtubeAuth } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// App single-user: guardamos só 1 linha de token (id=1), não é multi-tenant.
const AUTH_ROW_ID = 1;

export const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"];

function getRedirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3050";
  return `${base}/api/auth/youtube/callback`;
}

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados — veja .env.example");
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export function getAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // força retornar refresh_token mesmo se já autorizou antes
    scope: YOUTUBE_SCOPES,
  });
}

export async function saveTokensFromCode(code: string): Promise<void> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.expiry_date) {
    throw new Error("Google não retornou access_token — tente autorizar de novo");
  }

  const existing = await getStoredTokens();
  const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
  if (!refreshToken) {
    throw new Error(
      "Google não retornou refresh_token. Revogue o acesso em myaccount.google.com/permissions e tente de novo."
    );
  }

  const row = {
    accessToken: tokens.access_token,
    refreshToken,
    expiresAt: new Date(tokens.expiry_date),
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(youtubeAuth).set(row).where(eq(youtubeAuth.id, AUTH_ROW_ID));
  } else {
    await db.insert(youtubeAuth).values({ id: AUTH_ROW_ID, ...row });
  }
}

async function getStoredTokens() {
  const [row] = await db.select().from(youtubeAuth).where(eq(youtubeAuth.id, AUTH_ROW_ID)).limit(1);
  return row ?? null;
}

export async function isYoutubeConnected(): Promise<boolean> {
  return (await getStoredTokens()) !== null;
}

// Retorna um client OAuth2 autenticado, renovando o access_token se preciso.
export async function getAuthenticatedClient() {
  const stored = await getStoredTokens();
  if (!stored) throw new Error("YouTube não conectado — acesse /api/auth/youtube pra autorizar");

  const client = getOAuthClient();
  client.setCredentials({
    access_token: stored.accessToken,
    refresh_token: stored.refreshToken,
    expiry_date: stored.expiresAt.getTime(),
  });

  if (stored.expiresAt.getTime() < Date.now() + 60_000) {
    const { credentials } = await client.refreshAccessToken();
    if (credentials.access_token && credentials.expiry_date) {
      await db
        .update(youtubeAuth)
        .set({
          accessToken: credentials.access_token,
          expiresAt: new Date(credentials.expiry_date),
          updatedAt: new Date(),
        })
        .where(eq(youtubeAuth.id, AUTH_ROW_ID));
      client.setCredentials(credentials);
    }
  }

  return client;
}
