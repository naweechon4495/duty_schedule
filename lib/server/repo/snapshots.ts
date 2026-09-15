import { SNAPSHOT_AUTO_KEEP } from "../../domain/schedule";
import type { MonthSchedule, ScheduleSnapshot, SnapshotKind } from "../../types";
import { db } from "../db";
import { badRequest } from "../http";
import { rowsToMonth } from "./schedule";

/** รหัสชุดสำรองจาก URL */
export function snapshotId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("รหัสข้อมูลสำรองไม่ถูกต้อง");
  return id;
}

/**
 * สำรองตารางเวรพยาบาลรายเดือน — ทุกคำสั่งทำฝั่ง SQL ล้วน (INSERT … SELECT / json_each)
 * จึงใส่ใน DB.batch() เดียวกับการเขียนทับได้: ถ้าเขียนทับสำเร็จ แปลว่าสำรองสำเร็จแล้วแน่นอน
 */

// สำรองอัตโนมัติ (before_*) เก็บล่าสุด SNAPSHOT_AUTO_KEEP ชุดต่อเดือน — ที่บันทึกเองและตอนติดตั้งเก็บจนกว่าจะลบ
const AUTO_KINDS = "('before_auto', 'before_clear', 'before_restore', 'before_import')";

// ?1 kind, ?2 note, ?3 username, ?4 ชื่อ — GROUP BY month: เดือนที่ไม่มีแถวจะไม่ถูกสำรอง
const SNAPSHOT_SQL = `
  INSERT INTO schedule_snapshots (month, kind, note, days, slots, rows_json, created_by, created_by_name)
  SELECT month, ?1, ?2, COUNT(DISTINCT day), SUM(CASE WHEN shift IN ('night_oncall', '_day') THEN 0 ELSE 1 END),
         json_group_array(json_array(day, shift, position, nurse_id)), ?3, ?4
  FROM schedule_slots`;

type Who = { username: string; fullname: string };

/** สำรองตารางปัจจุบันของเดือน (เดือนที่ยังไม่มีตาราง = ไม่เพิ่มแถว) */
export function snapshotStmt(month: string, kind: SnapshotKind, who: Who, note = ""): D1PreparedStatement {
  return db()
    .prepare(`${SNAPSHOT_SQL} WHERE month = ?5 GROUP BY month`)
    .bind(kind, note.slice(0, 200), who.username, who.fullname, month);
}

/** สำรองทุกเดือนที่มีตาราง (ใช้ก่อน Import ข้อมูลทั้งหมด) */
export function snapshotAllStmt(kind: SnapshotKind, who: Who, note = ""): D1PreparedStatement {
  return db().prepare(`${SNAPSHOT_SQL} GROUP BY month`).bind(kind, note.slice(0, 200), who.username, who.fullname);
}

/** ลบสำรองอัตโนมัติเก่าที่เกิน SNAPSHOT_AUTO_KEEP ชุด — ใส่ท้าย batch เสมอ (หลังกู้คืนเสร็จ) */
export function pruneAutoStmt(month: string): D1PreparedStatement {
  return db()
    .prepare(
      `DELETE FROM schedule_snapshots WHERE month = ?1 AND kind IN ${AUTO_KINDS}
       AND id NOT IN (SELECT id FROM schedule_snapshots WHERE month = ?1 AND kind IN ${AUTO_KINDS} ORDER BY id DESC LIMIT ?2)`,
    )
    .bind(month, SNAPSHOT_AUTO_KEEP);
}

/** แทนตารางทั้งเดือนด้วยข้อมูลสำรอง (ถ้าไม่พบชุดสำรองของเดือนนี้ จะไม่ลบตารางเดิม) */
export function restoreStmts(id: number, month: string): D1PreparedStatement[] {
  return [
    db()
      .prepare("DELETE FROM schedule_slots WHERE month = ?1 AND EXISTS (SELECT 1 FROM schedule_snapshots WHERE id = ?2 AND month = ?1)")
      .bind(month, id),
    db()
      .prepare(
        `INSERT INTO schedule_slots (month, day, shift, position, nurse_id)
         SELECT ?1, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]')
         FROM json_each((SELECT rows_json FROM schedule_snapshots WHERE id = ?2 AND month = ?1))`,
      )
      .bind(month, id),
  ];
}

interface SnapshotRow {
  id: number;
  month: string;
  kind: SnapshotKind;
  note: string;
  days: number;
  slots: number;
  created_at: string;
  created_by: string;
  created_by_name: string;
}

const toMeta = (r: SnapshotRow): ScheduleSnapshot => ({
  id: r.id,
  month: r.month,
  kind: r.kind,
  note: r.note,
  days: r.days,
  slots: r.slots,
  createdAt: r.created_at,
  createdBy: r.created_by,
  createdByName: r.created_by_name,
});

const META_COLS = "id, month, kind, note, days, slots, created_at, created_by, created_by_name";

export async function listSnapshots(month: string): Promise<ScheduleSnapshot[]> {
  const { results } = await db()
    .prepare(`SELECT ${META_COLS} FROM schedule_snapshots WHERE month = ? ORDER BY id DESC LIMIT 200`)
    .bind(month)
    .all<SnapshotRow>();
  return results.map(toMeta);
}

export async function getSnapshotMeta(id: number): Promise<ScheduleSnapshot | null> {
  const r = await db().prepare(`SELECT ${META_COLS} FROM schedule_snapshots WHERE id = ?`).bind(id).first<SnapshotRow>();
  return r ? toMeta(r) : null;
}

export async function getSnapshot(id: number): Promise<(ScheduleSnapshot & { monthSchedule: MonthSchedule }) | null> {
  const r = await db()
    .prepare(`SELECT ${META_COLS}, rows_json FROM schedule_snapshots WHERE id = ?`)
    .bind(id)
    .first<SnapshotRow & { rows_json: string }>();
  if (!r) return null;
  return { ...toMeta(r), monthSchedule: rowsToMonth(JSON.parse(r.rows_json)) };
}
