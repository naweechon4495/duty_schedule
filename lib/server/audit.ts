import type { AppName } from "./auth";
import { db } from "./db";

export interface ActorContext {
  app: AppName;
  username: string;
  fullname: string;
  ip: string;
  userAgent: string;
}

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}

const SECRET_KEYS = new Set(["password", "password_hash", "passwordHash", "token", "token_hash"]);

function scrub(v: unknown): unknown {
  if (v === undefined || v === null) return v;
  return JSON.parse(JSON.stringify(v, (k, val) => (SECRET_KEYS.has(k) ? undefined : val)));
}

/** เก็บเฉพาะฟิลด์ที่เปลี่ยนจริง (สำหรับ action update) */
export function diffFields<T extends object>(before: T, after: T): { before: Partial<T>; after: Partial<T> } | null {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof T>;
  keys.forEach((k) => {
    if (SECRET_KEYS.has(String(k))) return;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      b[k] = before[k];
      a[k] = after[k];
    }
  });
  return Object.keys(a).length ? { before: b, after: a } : null;
}

/** statement สำหรับใส่ใน DB.batch() เดียวกับการแก้ข้อมูล — แก้สำเร็จ = มี log เสมอ */
export function auditStmt(ctx: ActorContext, e: AuditInput): D1PreparedStatement {
  return db()
    .prepare(
      `INSERT INTO audit_log (app, actor, actor_name, action, entity, entity_id, summary, before_json, after_json, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      ctx.app,
      ctx.username,
      ctx.fullname,
      e.action,
      e.entity,
      e.entityId ?? "",
      e.summary.slice(0, 1000),
      e.before === undefined ? null : JSON.stringify(scrub(e.before)),
      e.after === undefined ? null : JSON.stringify(scrub(e.after)),
      ctx.ip.slice(0, 64),
      ctx.userAgent.slice(0, 300),
    );
}

export function requestMeta(req: Request): { ip: string; userAgent: string } {
  return {
    ip: req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "",
    userAgent: req.headers.get("User-Agent") || "",
  };
}
