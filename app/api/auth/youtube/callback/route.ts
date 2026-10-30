import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { saveTokensFromCode, YT_STATE_COOKIE } from "@/lib/sources/googleAuth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  if (error) {
    return NextResponse.json({ error: `Google retornou: ${error}` }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "sem código de autorização na URL" }, { status: 400 });
  }

  const expected = (await cookies()).get(YT_STATE_COOKIE)?.value;
  if (!state || !expected || state !== expected) {
    return NextResponse.json(
      { error: "fluxo de autorização inválido — comece de novo em /api/auth/youtube" },
      { status: 400 }
    );
  }

  try {
    await saveTokensFromCode(code);
    const res = NextResponse.redirect(new URL("/videos?connected=1", req.url));
    res.cookies.delete({ name: YT_STATE_COOKIE, path: "/api/auth/youtube" });
    return res;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
