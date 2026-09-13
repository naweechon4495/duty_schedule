import type { AuditEntry } from "../types";
import type { AppName } from "./auth";
import { db, parseJson } from "./db";

export interface LogQuery {
  from?: string; // ISO หรือ YYYY-MM-DD
  to?: string;
  actor?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  q?: string;
  page?: number;
}

export const LOG_PAGE_SIZE = 50;

/** ค้นหา log แบบแบ่งหน้า — กรองตาม app เสมอ (NA ไม่เห็น log ของพยาบาล และกลับกัน) */
export async function queryLogs(app: AppName, q: LogQuery) {
  const where = ["app = ?"];
  const binds: unknown[] = [app];
  if (q.from) {
    where.push("at >= ?");
    binds.push(q.from.length === 10 ? new Date(q.from + "T00:00:00+07:00").toISOString() : q.from);
  }
  if (q.to) {
    where.push("at < ?");
    binds.push(q.to.length === 10 ? new Date(new Date(q.to + "T00:00:00+07:00").getTime() + 86400_000).toISOString() : q.to);
  }
  if (q.actor) {
    where.push("actor = ?");
    binds.push(q.actor);
  }
  if (q.action) {
    where.push("action = ?");
    binds.push(q.action);
  }
  if (q.entity) {
    where.push("entity = ?");
    binds.push(q.entity);
  }
  if (q.entityId) {
    where.push("entity_id = ?");
    binds.push(q.entityId);
  }
  if (q.q) {
    where.push("(summary LIKE ? OR actor_name LIKE ? OR actor LIKE ?)");
    const like = "%" + q.q.replace(/[%_]/g, "") + "%";
    binds.push(like, like, like);
  }
  const page = Math.max(1, q.page || 1);
  const sqlWhere = where.join(" AND ");
  const [rows, count, actors] = await Promise.all([
    db()
      .prepare(`SELECT * FROM audit_log WHERE ${sqlWhere} ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...binds, LOG_PAGE_SIZE, (page - 1) * LOG_PAGE_SIZE)
      .all<Record<string, string | number | null>>(),
    db().prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE ${sqlWhere}`).bind(...binds).first<{ n: number }>(),
    db()
      .prepare("SELECT actor, MAX(actor_name) AS actor_name FROM audit_log WHERE app = ? AND actor != '' GROUP BY actor ORDER BY actor")
      .bind(app)
      .all<{ actor: string; actor_name: string }>(),
  ]);
  const entries: AuditEntry[] = rows.results.map((r) => ({
    id: Number(r.id),
    at: String(r.at),
    app: r.app as AppName,
    actor: String(r.actor),
    actorName: String(r.actor_name || ""),
    action: String(r.action),
    entity: String(r.entity),
    entityId: String(r.entity_id || ""),
    summary: String(r.summary),
    before: parseJson(r.before_json, null),
    after: parseJson(r.after_json, null),
  }));
  return {
    entries,
    total: count?.n ?? 0,
    page,
    pageSize: LOG_PAGE_SIZE,
    actors: actors.results.map((a) => ({ username: a.actor, fullname: a.actor_name })),
  };
}

export function logQueryFromUrl(url: string): LogQuery {
  const p = new URL(url).searchParams;
  const get = (k: string) => (p.get(k) || "").trim().slice(0, 200) || undefined;
  return {
    from: get("from"),
    to: get("to"),
    actor: get("actor"),
    action: get("action"),
    entity: get("entity"),
    entityId: get("entityId"),
    q: get("q"),
    page: Number(p.get("page")) || 1,
  };
}
