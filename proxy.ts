import { NextResponse, type NextRequest } from "next/server";
import { CARTEIRA_COOKIE, isCarteiraAuthorized } from "@/lib/carteiraAuth";

// Checagem rápida na borda — as rotas de API e a página da Carteira checam de novo no
// servidor (o proxy sozinho não deve ser a única barreira, segundo a doc do Next).
export async function proxy(request: NextRequest) {
  if (await isCarteiraAuthorized(request.cookies.get(CARTEIRA_COOKIE)?.value)) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const login = new URL("/entrar", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/forex/carteira/:path*", "/api/carteira/:path*"],
};
