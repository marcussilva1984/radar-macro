import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { topicRequests } from "@/lib/db/schema";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 200) {
    return NextResponse.json({ error: "texto inválido" }, { status: 400 });
  }

  await db.insert(topicRequests).values({ text });
  return NextResponse.json({ ok: true });
}
