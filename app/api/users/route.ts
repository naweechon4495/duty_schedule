import type { Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/domain/roles";
import { auditStmt } from "@/lib/server/audit";
import { hashPassword, validatePassword } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { HttpError, badRequest, json, readJson, route, str } from "@/lib/server/http";
import { getUserWithHash } from "@/lib/server/repo/misc";

export const POST = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.manageUsers);
  const b = await readJson<{ username?: string; password?: string; fullname?: string; role?: string; nurseCode?: string }>(req);
  const username = str(b.username, 100);
  const fullname = str(b.fullname, 200);
  const role = String(b.role) as Role;
  const password = String(b.password ?? "");
  if (!username || !fullname) throw badRequest("กรุณากรอกข้อมูลให้ครบ");
  if (!/^[\w.@-]+$/.test(username)) throw badRequest("ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, _ . @ -");
  if (!ROLE_LABELS[role]) throw badRequest("บทบาทไม่ถูกต้อง");
  validatePassword(password);
  if (await getUserWithHash(username)) throw new HttpError(409, "ชื่อผู้ใช้นี้มีอยู่แล้ว");
  const nurseCode = str(b.nurseCode, 50);
  await db().batch([
    db()
      .prepare("INSERT INTO users (username, password_hash, fullname, role, nurse_code) VALUES (?, ?, ?, ?, ?)")
      .bind(username, await hashPassword(password), fullname, role, nurseCode),
    auditStmt(actor, {
      action: "create",
      entity: "user",
      entityId: username,
      summary: `เพิ่มผู้ใช้ ${username} (${fullname}) บทบาท${ROLE_LABELS[role]}` + (nurseCode ? ` ผูกพยาบาล ${nurseCode}` : ""),
      after: { username, fullname, role, nurseCode },
    }),
  ]);
  return json({ ok: true });
});
