import { NextResponse } from "next/server";
import { saveTokensFromCode } from "@/lib/sources/googleAuth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error: `Google retornou: ${error}` }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "sem código de autorização na URL" }, { status: 400 });
  }

  try {
    await saveTokensFromCode(code);
    return NextResponse.redirect(new URL("/videos?connected=1", req.url));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
