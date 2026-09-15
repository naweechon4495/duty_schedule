import type { MonthSchedule, Schedule } from "../../types";
import { db } from "../db";

/**
 * ตารางเวรเก็บเป็นแถว (month, day, shift, position, id)
 * อ่าน: รวมกลับเป็นรูปแบบเดิม schedule[month][day][shift] = [ids ตามลำดับ]
 * เขียน: แทนทั้งเดือนด้วย 2 คำสั่ง (DELETE + INSERT ผ่าน json_each) — ไม่ชนเพดานจำนวน query ต่อ request ของ D1
 */
interface SlotTable {
  table: "schedule_slots" | "na_schedule_slots";
  idCol: "nurse_id" | "assistant_id";
}
export const NURSE_SLOTS: SlotTable = { table: "schedule_slots", idCol: "nurse_id" };
export const NA_SLOTS: SlotTable = { table: "na_schedule_slots", idCol: "assistant_id" };

interface SlotRow {
  month: string;
  day: number;
  shift: string;
  position: number;
  person: string;
}

function rowsToSchedule(rows: SlotRow[]): Schedule {
  const out: Schedule = {};
  for (const r of rows) {
    const ms = (out[r.month] ||= {});
    const ds = (ms[r.day] ||= {});
    if (r.shift === DAY_MARKER) continue;
    (ds[r.shift] ||= []).push(r.person);
  }
  return out;
}

/** แถวพิเศษแทน "วันที่สร้างไว้แล้วแต่ยังไม่มีคน" (แยกจากวันที่ยังไม่ได้จัดเวรเลย) */
const DAY_MARKER = "_day";

export async function loadSchedule(t: SlotTable = NURSE_SLOTS): Promise<Schedule> {
  const { results } = await db()
    .prepare(`SELECT month, day, shift, position, ${t.idCol} AS person FROM ${t.table} ORDER BY month, day, shift, position`)
    .all<SlotRow>();
  return rowsToSchedule(results);
}

export async function loadMonth(month: string, t: SlotTable = NURSE_SLOTS): Promise<MonthSchedule> {
  const { results } = await db()
    .prepare(`SELECT month, day, shift, position, ${t.idCol} AS person FROM ${t.table} WHERE month = ? ORDER BY day, shift, position`)
    .bind(month)
    .all<SlotRow>();
  return rowsToSchedule(results)[month] || {};
}

/** แถว [day, shift, position, id] (เช่นจากข้อมูลสำรอง) → รูปแบบเดือน */
export function rowsToMonth(rows: [number, string, number, string][]): MonthSchedule {
  const sorted = rows.slice().sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]) || a[2] - b[2]);
  return rowsToSchedule(sorted.map(([day, shift, position, person]) => ({ month: "m", day, shift, position, person })))["m"] || {};
}

/** แปลงเดือนเป็นรายการแถว [day, shift, position, id] (ข้ามรายการซ้ำในกะเดียวกัน) */
export function monthToRows(ms: MonthSchedule): [number, string, number, string][] {
  const rows: [number, string, number, string][] = [];
  for (const [dayStr, ds] of Object.entries(ms)) {
    const day = Number(dayStr);
    const before = rows.length;
    for (const [shift, ids] of Object.entries(ds)) {
      if (shift === DAY_MARKER) continue;
      const seen = new Set<string>();
      (ids || []).forEach((id) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        rows.push([day, shift, seen.size - 1, id]);
      });
    }
    if (rows.length === before) rows.push([day, DAY_MARKER, 0, ""]);
  }
  return rows;
}

export function writeMonthStmts(month: string, ms: MonthSchedule, t: SlotTable = NURSE_SLOTS): D1PreparedStatement[] {
  const stmts = [db().prepare(`DELETE FROM ${t.table} WHERE month = ?`).bind(month)];
  const rows = monthToRows(ms);
  if (rows.length) {
    stmts.push(
      db()
        .prepare(
          `INSERT INTO ${t.table} (month, day, shift, position, ${t.idCol})
           SELECT ?1, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]')
           FROM json_each(?2)`,
        )
        .bind(month, JSON.stringify(rows)),
    );
  }
  return stmts;
}

export function countSlots(ms: MonthSchedule): number {
  return monthToRows(ms).filter(([, shift]) => shift !== "night_oncall" && shift !== DAY_MARKER).length;
}
