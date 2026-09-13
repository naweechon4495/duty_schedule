import { db, nowIso } from "./db";
import { HttpError } from "./http";

// ===================== รหัสผ่าน =====================
// รูปแบบที่เก็บ: pbkdf2$<iterations>$<salt base64>$<hash base64>
// เก็บจำนวนรอบไว้ใน hash เพื่อเพิ่มรอบในอนาคตได้โดยไม่ต้องรีเซ็ตรหัสทุกคน

export const PBKDF2_ITERATIONS = 100_000;
const enc = new TextEncoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  arr.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const expected = unb64(parts[3]);
  const actual = new Uint8Array(await pbkdf2(password, unb64(parts[2]), iterations));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function validatePassword(pw: string): void {
  if (pw.length < 6) throw new HttpError(400, "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร");
  if (pw.length > 128) throw new HttpError(400, "รหัสผ่านยาวเกินไป");
}

// ===================== Session =====================

export type AppName = "nurse" | "na";
export const SESSION_COOKIE: Record<AppName, string> = { nurse: "nawee_session", na: "nawee_na_session" };
const SESSION_DAYS = 30;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(app: AppName, username: string): Promise<string> {
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await db()
    .prepare("INSERT INTO sessions (token_hash, app, username, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), app, username, expires)
    .run();
  return token;
}

/** username ของ session (ถ้ายังไม่หมดอายุ) */
export async function sessionUsername(app: AppName, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const row = await db()
    .prepare("SELECT username FROM sessions WHERE token_hash = ? AND app = ? AND expires_at > ?")
    .bind(await sha256Hex(token), app, nowIso())
    .first<{ username: string }>();
  return row?.username ?? null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}

export function deleteUserSessionsStmt(app: AppName, username: string): D1PreparedStatement {
  return db().prepare("DELETE FROM sessions WHERE app = ? AND username = ?").bind(app, username);
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function sessionCookie(app: AppName, token: string): string {
  return `${SESSION_COOKIE[app]}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearSessionCookie(app: AppName): string {
  return `${SESSION_COOKIE[app]}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** กันเดารหัส: รหัสผิดเกิน 10 ครั้งใน 15 นาทีต่อชื่อผู้ใช้ → พักการเข้าสู่ระบบ */
export async function assertNotRateLimited(app: AppName, username: string): Promise<void> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const row = await db()
    .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE app = ? AND action = 'login_failed' AND entity_id = ? AND at > ?")
    .bind(app, username, since)
    .first<{ n: number }>();
  if ((row?.n ?? 0) >= 10) throw new HttpError(429, "ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่");
}
