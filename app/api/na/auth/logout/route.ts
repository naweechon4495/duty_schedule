import { auditStmt, requestMeta } from "@/lib/server/audit";
import { SESSION_COOKIE, clearSessionCookie, deleteSession, readCookie, sessionUsername } from "@/lib/server/auth";
import { loadNAUser } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const token = readCookie(req, SESSION_COOKIE.na);
  const username = await sessionUsername("na", token);
  if (username) {
    const u = await loadNAUser(username);
    await auditStmt({ app: "na", username, fullname: u?.fullname ?? "", ...requestMeta(req) }, { action: "logout", entity: "session", entityId: username, summary: "ออกจากระบบ" }).run();
  }
  await deleteSession(token);
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie("na") } });
});
