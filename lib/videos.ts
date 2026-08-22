import "server-only";
import { db } from "@/lib/db/client";
import { youtubeVideos } from "@/lib/db/schema";
import { desc, gte } from "drizzle-orm";

export async function getRecentVideos(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(youtubeVideos)
    .where(gte(youtubeVideos.publishedAt, since))
    .orderBy(desc(youtubeVideos.publishedAt))
    .limit(100);

  return {
    followed: rows.filter((r) => r.subscribed),
    discovered: rows.filter((r) => !r.subscribed),
  };
}
