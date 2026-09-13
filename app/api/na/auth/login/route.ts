import { auditStmt, requestMeta } from "@/lib/server/audit";
import { assertNotRateLimited, createSession, sessionCookie, verifyPassword } from "@/lib/server/auth";
import { HttpError, json, readJson, route, str } from "@/lib/server/http";
import { getNAUserWithHash } from "@/lib/server/repo/misc";

export const POST = route(async (req) => {
  const body = await readJson<{ username?: string; password?: string }>(req);
  const username = str(body.username, 100);
  const password = String(body.password ?? "");
  if (!username || !password) throw new HttpError(400, "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
  await assertNotRateLimited("na", username);
  const user = await getNAUserWithHash(username);
  const meta = requestMeta(req);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await auditStmt({ app: "na", username: "", fullname: "", ...meta }, { action: "login_failed", entity: "session", entityId: username, summary: `เข้าสู่ระบบไม่สำเร็จ (ชื่อผู้ใช้ ${username})` }).run();
    throw new HttpError(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
  const token = await createSession("na", user.username);
  await auditStmt({ app: "na", username: user.username, fullname: user.fullname, ...meta }, { action: "login", entity: "session", entityId: user.username, summary: "เข้าสู่ระบบ" }).run();
  return json({ ok: true }, { headers: { "Set-Cookie": sessionCookie("na", token) } });
});
