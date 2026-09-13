import { auditStmt } from "@/lib/server/audit";
import { deleteUserSessionsStmt, hashPassword, validatePassword } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { json, notFound, readJson, route } from "@/lib/server/http";
import { getUserWithHash } from "@/lib/server/repo/misc";

type Ctx = { params: Promise<{ username: string }> };

/** แอดมินตั้งรหัสผ่านใหม่ให้ผู้ใช้ — ออกจากระบบทุกเครื่องของผู้ใช้นั้น */
export const POST = route<Ctx>(async (req, { params }) => {
  const { username } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.manageUsers);
  const u = await getUserWithHash(username);
  if (!u) throw notFound("ไม่พบผู้ใช้");
  const { password } = await readJson<{ password?: string }>(req);
  validatePassword(String(password ?? ""));
  await db().batch([
    db().prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?").bind(await hashPassword(String(password)), new Date().toISOString(), username),
    ...(username === actor.username ? [] : [deleteUserSessionsStmt("nurse", username)]),
    auditStmt(actor, { action: "reset_password", entity: "user", entityId: username, summary: `ตั้งรหัสผ่านใหม่ให้ ${username} (${u.fullname})` }),
  ]);
  return json({ ok: true });
});
