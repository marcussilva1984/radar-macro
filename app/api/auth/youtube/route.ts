import { NextResponse } from "next/server";
import { getAuthUrl, YT_STATE_COOKIE } from "@/lib/sources/googleAuth";
import { requestIsCarteiraAuthorized } from "@/lib/carteiraAuth";

// Acesse /api/auth/youtube logado no navegador — redireciona pra tela de consentimento do Google.
// Exige a mesma senha da Carteira (quando configurada) pra iniciar a conexão.
export async function GET() {
  if (!(await requestIsCarteiraAuthorized())) {
    return NextResponse.json({ error: "não autorizado — entre em /entrar primeiro" }, { status: 401 });
  }
  try {
    const state = crypto.randomUUID();
    const res = NextResponse.redirect(getAuthUrl(state));
    res.cookies.set(YT_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/youtube",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
