import { auditStmt, requestMeta } from "@/lib/server/audit";
import { SESSION_COOKIE, clearSessionCookie, deleteSession, readCookie, sessionUsername } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { loadNurseUser } from "@/lib/server/guard";

export const POST = route(async (req) => {
  const token = readCookie(req, SESSION_COOKIE.nurse);
  const username = await sessionUsername("nurse", token);
  if (username) {
    const user = await loadNurseUser(username);
    await auditStmt(
      { app: "nurse", username, fullname: user?.fullname ?? "", ...requestMeta(req) },
      { action: "logout", entity: "session", entityId: username, summary: "ออกจากระบบ" },
    ).run();
  }
  await deleteSession(token);
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie("nurse") } });
});
