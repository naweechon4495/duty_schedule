import type { Role } from "@/lib/types";
import { auditStmt, diffFields } from "@/lib/server/audit";
import { deleteUserSessionsStmt } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { HttpError, badRequest, json, notFound, readJson, route, str } from "@/lib/server/http";
import { getUserWithHash } from "@/lib/server/repo/misc";
import { changeSummary } from "@/lib/server/summary";
import { ROLE_LABELS } from "@/lib/domain/roles";

type Ctx = { params: Promise<{ username: string }> };

async function adminCount(): Promise<number> {
  const r = await db().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first<{ n: number }>();
  return r?.n ?? 0;
}

export const PUT = route<Ctx>(async (req, { params }) => {
  const { username } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.manageUsers);
  const u = await getUserWithHash(username);
  if (!u) throw notFound("ไม่พบผู้ใช้");
  const b = await readJson<{ fullname?: string; role?: string; nurseCode?: string }>(req);
  const fullname = str(b.fullname, 200);
  const role = String(b.role) as Role;
  if (!fullname) throw badRequest("กรุณากรอกชื่อ-นามสกุล");
  if (!ROLE_LABELS[role]) throw badRequest("บทบาทไม่ถูกต้อง");
  if (u.role === "admin" && role !== "admin" && (await adminCount()) <= 1) throw new HttpError(409, "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน");
  const before = { fullname: u.fullname, role: u.role, nurseCode: u.nurse_code };
  const after = { fullname, role, nurseCode: str(b.nurseCode, 50) };
  const diff = diffFields(before, after);
  if (!diff) return json({ ok: true, unchanged: true });
  await db().batch([
    db()
      .prepare("UPDATE users SET fullname = ?, role = ?, nurse_code = ?, updated_at = ? WHERE username = ?")
      .bind(after.fullname, after.role, after.nurseCode, new Date().toISOString(), username),
    auditStmt(actor, {
      action: "update",
      entity: "user",
      entityId: username,
      summary: changeSummary(`แก้ไขผู้ใช้ ${username}`, diff.before, diff.after),
      before: diff.before,
      after: diff.after,
    }),
  ]);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { username } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.manageUsers);
  if (username === actor.username) throw badRequest("ลบบัญชีของตัวเองไม่ได้");
  const u = await getUserWithHash(username);
  if (!u) throw notFound("ไม่พบผู้ใช้");
  if (u.role === "admin" && (await adminCount()) <= 1) throw new HttpError(409, "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน");
  await db().batch([
    db().prepare("DELETE FROM users WHERE username = ?").bind(username),
    deleteUserSessionsStmt("nurse", username),
    auditStmt(actor, {
      action: "delete",
      entity: "user",
      entityId: username,
      summary: `ลบผู้ใช้ ${username} (${u.fullname})`,
      before: { username, fullname: u.fullname, role: u.role, nurseCode: u.nurse_code },
    }),
  ]);
  return json({ ok: true });
});
