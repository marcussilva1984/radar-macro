import { NextResponse } from "next/server";
import { CARTEIRA_COOKIE, carteiraToken, checkCarteiraPassword } from "@/lib/carteiraAuth";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const password = String(form?.get("password") ?? "");
  const nextPath = String(form?.get("next") ?? "/forex/carteira");
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/forex/carteira";

  if (!(await checkCarteiraPassword(password))) {
    return NextResponse.redirect(new URL(`/entrar?erro=1&next=${encodeURIComponent(safeNext)}`, req.url), 303);
  }

  const res = NextResponse.redirect(new URL(safeNext, req.url), 303);
  res.cookies.set(CARTEIRA_COOKIE, await carteiraToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
