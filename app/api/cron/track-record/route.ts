import { NextResponse } from "next/server";
import { snapshotIdeas, evaluateIdeas } from "@/lib/trackRecord";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const evaluated = await evaluateIdeas();
    const snapshotted = await snapshotIdeas();
    return NextResponse.json({ ok: true, evaluated, snapshotted });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
