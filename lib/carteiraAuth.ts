// Proteção da aba Carteira com uma senha única (app de um usuário só). O cookie guarda um
// hash da senha — nunca a senha em si. Sem CARTEIRA_PASSWORD configurada, a aba fica aberta
// (comportamento anterior), pra não trancar ninguém fora antes da senha existir.
export const CARTEIRA_COOKIE = "carteira_auth";

export async function carteiraToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`radar-macro:carteira:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function carteiraProtectionEnabled(): boolean {
  return Boolean(process.env.CARTEIRA_PASSWORD);
}

export async function isCarteiraAuthorized(cookieValue: string | undefined): Promise<boolean> {
  const password = process.env.CARTEIRA_PASSWORD;
  if (!password) return true;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await carteiraToken(password));
}

// Pra usar dentro de route handlers / server components (segunda barreira além do proxy).
export async function requestIsCarteiraAuthorized(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return isCarteiraAuthorized(store.get(CARTEIRA_COOKIE)?.value);
}

export async function checkCarteiraPassword(attempt: string): Promise<boolean> {
  const password = process.env.CARTEIRA_PASSWORD;
  if (!password) return true;
  return safeEqual(await carteiraToken(attempt), await carteiraToken(password));
}
