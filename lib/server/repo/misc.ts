import type { Holiday, NAPublicUser, NARole, PublicUser, Role } from "../../types";
import { db, nowIso } from "../db";

// ===================== วันหยุดพิเศษ =====================

export async function listHolidays(): Promise<Holiday[]> {
  const { results } = await db().prepare("SELECT date, name FROM holidays ORDER BY date").all<Holiday>();
  return results;
}

export async function getHoliday(date: string): Promise<Holiday | null> {
  return db().prepare("SELECT date, name FROM holidays WHERE date = ?").bind(date).first<Holiday>();
}

// ===================== ผู้ใช้ระบบพยาบาล =====================

export async function listUsers(): Promise<PublicUser[]> {
  const { results } = await db()
    .prepare("SELECT username, fullname, role, nurse_code FROM users ORDER BY role, username")
    .all<{ username: string; fullname: string; role: Role; nurse_code: string }>();
  return results.map((r) => ({ username: r.username, fullname: r.fullname, role: r.role, nurseCode: r.nurse_code }));
}

export async function getUserWithHash(username: string) {
  return db()
    .prepare("SELECT username, password_hash, fullname, role, nurse_code FROM users WHERE username = ?")
    .bind(username)
    .first<{ username: string; password_hash: string; fullname: string; role: Role; nurse_code: string }>();
}

export function touchUpdated() {
  return nowIso();
}

// ===================== ผู้ใช้ระบบ NA =====================

export async function listNAUsers(): Promise<NAPublicUser[]> {
  const { results } = await db()
    .prepare("SELECT username, fullname, role, assistant_code FROM na_users ORDER BY role, username")
    .all<{ username: string; fullname: string; role: NARole; assistant_code: string }>();
  return results.map((r) => ({ username: r.username, fullname: r.fullname, role: r.role, assistantCode: r.assistant_code }));
}

export async function getNAUserWithHash(username: string) {
  return db()
    .prepare("SELECT username, password_hash, fullname, role, assistant_code FROM na_users WHERE username = ?")
    .bind(username)
    .first<{ username: string; password_hash: string; fullname: string; role: NARole; assistant_code: string }>();
}
