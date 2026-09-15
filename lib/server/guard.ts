import type { NAPublicUser, NARole, PublicUser, Role } from "../types";
import type { ActorContext } from "./audit";
import { requestMeta } from "./audit";
import { SESSION_COOKIE, readCookie, sessionUsername } from "./auth";
import { db } from "./db";
import { HttpError } from "./http";

export interface NurseActor extends ActorContext {
  app: "nurse";
  user: PublicUser;
}
export interface NAActor extends ActorContext {
  app: "na";
  user: NAPublicUser;
}

export async function loadNurseUser(username: string): Promise<PublicUser | null> {
  const r = await db()
    .prepare("SELECT username, fullname, role, nurse_code FROM users WHERE username = ?")
    .bind(username)
    .first<{ username: string; fullname: string; role: Role; nurse_code: string }>();
  return r ? { username: r.username, fullname: r.fullname, role: r.role, nurseCode: r.nurse_code } : null;
}

export async function loadNAUser(username: string): Promise<NAPublicUser | null> {
  const r = await db()
    .prepare("SELECT username, fullname, role, assistant_code FROM na_users WHERE username = ?")
    .bind(username)
    .first<{ username: string; fullname: string; role: NARole; assistant_code: string }>();
  return r ? { username: r.username, fullname: r.fullname, role: r.role, assistantCode: r.assistant_code } : null;
}

/** ผู้ใช้ระบบพยาบาลที่ login อยู่ — ไม่ login = 401, บทบาทไม่พอ = 403 */
export async function requireNurse(req: Request, roles?: Role[]): Promise<NurseActor> {
  const username = await sessionUsername("nurse", readCookie(req, SESSION_COOKIE.nurse));
  const user = username ? await loadNurseUser(username) : null;
  if (!user) throw new HttpError(401, "กรุณาเข้าสู่ระบบ");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "คุณไม่มีสิทธิ์ทำรายการนี้");
  return { app: "nurse", username: user.username, fullname: user.fullname, user, ...requestMeta(req) };
}

export async function requireNA(req: Request, roles?: NARole[]): Promise<NAActor> {
  const username = await sessionUsername("na", readCookie(req, SESSION_COOKIE.na));
  const user = username ? await loadNAUser(username) : null;
  if (!user) throw new HttpError(401, "กรุณาเข้าสู่ระบบ");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "คุณไม่มีสิทธิ์ทำรายการนี้");
  return { app: "na", username: user.username, fullname: user.fullname, user, ...requestMeta(req) };
}

/** สิทธิ์ของแต่ละบทบาท (ตรงกับระบบเดิม applyRolePermissions) */
export const NURSE_PERMS = {
  manageNurses: ["admin"] as Role[],
  manageHolidays: ["admin"] as Role[],
  manageUsers: ["admin"] as Role[],
  runSchedule: ["admin", "approver"] as Role[],
  editScheduleDay: ["admin"] as Role[],
  approve: ["admin", "approver"] as Role[],
  deleteRequests: ["admin"] as Role[],
  viewLogs: ["admin"] as Role[],
  backup: ["admin"] as Role[],
  /** ดู/บันทึก/กู้คืนข้อมูลสำรองตารางเวร = คนที่จัดเวรได้, ลบข้อมูลสำรอง = แอดมิน */
  deleteSnapshot: ["admin"] as Role[],
};
