import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";
import { logQueryFromUrl, queryLogs } from "@/lib/server/logs";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireNurse(req, NURSE_PERMS.viewLogs);
  return json(await queryLogs("nurse", logQueryFromUrl(req.url)));
});
