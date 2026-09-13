import { requireNA } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";
import { logQueryFromUrl, queryLogs } from "@/lib/server/logs";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireNA(req, ["naadmin"]);
  return json(await queryLogs("na", logQueryFromUrl(req.url)));
});
