import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const row = await db().prepare("SELECT COUNT(*) AS n FROM nurses").first<{ n: number }>();
  return Response.json({ ok: true, nurses: row?.n ?? 0 });
}
