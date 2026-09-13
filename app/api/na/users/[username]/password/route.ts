import { auditStmt } from "@/lib/server/audit";
import { deleteUserSessionsStmt, hashPassword, validatePassword } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { json, notFound, readJson, route } from "@/lib/server/http";
import { getNAUserWithHash } from "@/lib/server/repo/misc";

type Ctx = { params: Promise<{ username: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { username } = await params;
  const actor = await requireNA(req, ["naadmin"]);
  const u = await getNAUserWithHash(username);
  if (!u) throw notFound("ไม่พบผู้ใช้");
  const { password } = await readJson<{ password?: string }>(req);
  validatePassword(String(password ?? ""));
  await db().batch([
    db().prepare("UPDATE na_users SET password_hash = ?, updated_at = ? WHERE username = ?").bind(await hashPassword(String(password)), new Date().toISOString(), username),
    ...(username === actor.username ? [] : [deleteUserSessionsStmt("na", username)]),
    auditStmt(actor, { action: "reset_password", entity: "user", entityId: username, summary: `ตั้งรหัสผ่านใหม่ให้ ${username} (${u.fullname})` }),
  ]);
  return json({ ok: true });
});
