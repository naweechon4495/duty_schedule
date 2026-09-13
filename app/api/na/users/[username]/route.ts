import type { NARole } from "@/lib/types";
import { NA_ROLE_LABELS } from "@/lib/domain/roles";
import { auditStmt, diffFields } from "@/lib/server/audit";
import { deleteUserSessionsStmt } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { HttpError, badRequest, json, notFound, readJson, route, str } from "@/lib/server/http";
import { getNAUserWithHash } from "@/lib/server/repo/misc";
import { changeSummary } from "@/lib/server/summary";

type Ctx = { params: Promise<{ username: string }> };

async function adminCount() {
  return (await db().prepare("SELECT COUNT(*) AS n FROM na_users WHERE role = 'naadmin'").first<{ n: number }>())?.n ?? 0;
}

export const PUT = route<Ctx>(async (req, { params }) => {
  const { username } = await params;
  const actor = await requireNA(req, ["naadmin"]);
  const u = await getNAUserWithHash(username);
  if (!u) throw notFound("ไม่พบผู้ใช้");
  const b = await readJson<{ fullname?: string; role?: string; assistantCode?: string }>(req);
  const role = String(b.role) as NARole;
  const fullname = str(b.fullname, 200);
  if (!fullname || !NA_ROLE_LABELS[role]) throw badRequest("กรุณากรอกข้อมูลให้ครบ");
  if (u.role === "naadmin" && role !== "naadmin" && (await adminCount()) <= 1) throw new HttpError(409, "ต้องมีผู้ดูแล NA อย่างน้อย 1 คน");
  const before = { fullname: u.fullname, role: u.role, assistantCode: u.assistant_code };
  const after = { fullname, role, assistantCode: role === "assistant" ? str(b.assistantCode, 50) : "" };
  const diff = diffFields(before, after);
  if (!diff) return json({ ok: true });
  await db().batch([
    db().prepare("UPDATE na_users SET fullname = ?, role = ?, assistant_code = ?, updated_at = ? WHERE username = ?").bind(after.fullname, after.role, after.assistantCode, new Date().toISOString(), username),
    auditStmt(actor, { action: "update", entity: "user", entityId: username, summary: changeSummary(`แก้ไขผู้ใช้ ${username}`, diff.before, diff.after), before: diff.before, after: diff.after }),
  ]);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { username } = await params;
  const actor = await requireNA(req, ["naadmin"]);
  if (username === actor.username) throw badRequest("ลบบัญชีของตัวเองไม่ได้");
  const u = await getNAUserWithHash(username);
  if (!u) throw notFound("ไม่พบผู้ใช้");
  if (u.role === "naadmin" && (await adminCount()) <= 1) throw new HttpError(409, "ต้องมีผู้ดูแล NA อย่างน้อย 1 คน");
  await db().batch([
    db().prepare("DELETE FROM na_users WHERE username = ?").bind(username),
    deleteUserSessionsStmt("na", username),
    auditStmt(actor, { action: "delete", entity: "user", entityId: username, summary: `ลบผู้ใช้ ${username} (${u.fullname})` }),
  ]);
  return json({ ok: true });
});
