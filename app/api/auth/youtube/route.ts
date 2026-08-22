import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/sources/googleAuth";

// Acesse /api/auth/youtube logado no navegador — redireciona pra tela de consentimento do Google.
export async function GET() {
  try {
    return NextResponse.redirect(getAuthUrl());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
