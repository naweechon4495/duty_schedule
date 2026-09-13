import type { NARole } from "@/lib/types";
import { NA_ROLE_LABELS } from "@/lib/domain/roles";
import { auditStmt } from "@/lib/server/audit";
import { hashPassword, validatePassword } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { HttpError, badRequest, json, readJson, route, str } from "@/lib/server/http";
import { getNAUserWithHash } from "@/lib/server/repo/misc";

export const POST = route(async (req) => {
  const actor = await requireNA(req, ["naadmin"]);
  const b = await readJson<{ username?: string; password?: string; fullname?: string; role?: string; assistantCode?: string }>(req);
  const username = str(b.username, 100);
  const fullname = str(b.fullname, 200);
  const role = String(b.role) as NARole;
  const password = String(b.password ?? "");
  if (!username || !fullname) throw badRequest("กรุณากรอกข้อมูลให้ครบ");
  if (!/^[\w.@-]+$/.test(username)) throw badRequest("ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, _ . @ -");
  if (!NA_ROLE_LABELS[role]) throw badRequest("บทบาทไม่ถูกต้อง");
  validatePassword(password);
  if (await getNAUserWithHash(username)) throw new HttpError(409, "ชื่อผู้ใช้นี้มีอยู่แล้ว");
  const assistantCode = role === "assistant" ? str(b.assistantCode, 50) : "";
  await db().batch([
    db().prepare("INSERT INTO na_users (username, password_hash, fullname, role, assistant_code) VALUES (?, ?, ?, ?, ?)").bind(username, await hashPassword(password), fullname, role, assistantCode),
    auditStmt(actor, { action: "create", entity: "user", entityId: username, summary: `เพิ่มผู้ใช้ ${username} (${fullname}) บทบาท${NA_ROLE_LABELS[role]}`, after: { username, fullname, role, assistantCode } }),
  ]);
  return json({ ok: true });
});
