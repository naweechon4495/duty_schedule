import type { Generation, Nurse } from "../../types";
import { db, nowIso, parseJson } from "../db";
import { badRequest, str } from "../http";

interface NurseRow {
  id: string;
  code: string;
  name: string;
  generation: string;
  phone: string;
  unavailable_dates: string;
  unavailable_weekdays: string;
  unavailable_shifts: string;
  unavailable_weeks: string;
  unavailable_months: string;
  unavailable_shifts_in_weeks: string;
  unavailable_shifts_in_months: string;
  unavailable_holidays: string;
  fixed_shifts: string;
}

export function rowToNurse(r: NurseRow): Nurse {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    generation: r.generation as Generation,
    phone: r.phone,
    unavailableDates: parseJson(r.unavailable_dates, []),
    unavailableWeekdays: parseJson(r.unavailable_weekdays, []),
    unavailableShifts: parseJson(r.unavailable_shifts, []),
    unavailableWeeks: parseJson(r.unavailable_weeks, []),
    unavailableMonths: parseJson(r.unavailable_months, []),
    unavailableShiftsInWeeks: parseJson(r.unavailable_shifts_in_weeks, []),
    unavailableShiftsInMonths: parseJson(r.unavailable_shifts_in_months, []),
    unavailableHolidays: parseJson(r.unavailable_holidays, []),
    fixedShifts: parseJson(r.fixed_shifts, []),
  };
}

export async function listNurses(): Promise<Nurse[]> {
  const { results } = await db().prepare("SELECT * FROM nurses ORDER BY code").all<NurseRow>();
  return results.map(rowToNurse);
}

export async function getNurse(id: string): Promise<Nurse | null> {
  const r = await db().prepare("SELECT * FROM nurses WHERE id = ?").bind(id).first<NurseRow>();
  return r ? rowToNurse(r) : null;
}

const GENS = ["1", "2", "3", "4", "staff"];
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

/** ตรวจ + ทำความสะอาดข้อมูลพยาบาลที่ส่งมาจากหน้าเว็บ */
export function sanitizeNurse(input: Partial<Nurse>, id: string): Nurse {
  const code = str(input.code, 50);
  const name = str(input.name, 200);
  if (!code || !name) throw badRequest("กรุณากรอกรหัสและชื่อ");
  const generation = String(input.generation ?? "1");
  if (!GENS.includes(generation)) throw badRequest("รุ่นไม่ถูกต้อง");
  return {
    id,
    code,
    name,
    generation: generation as Generation,
    phone: str(input.phone, 50),
    unavailableDates: arr(input.unavailableDates).map(String),
    unavailableWeekdays: arr(input.unavailableWeekdays).map(Number).filter((n) => n >= 0 && n <= 6),
    unavailableShifts: arr(input.unavailableShifts),
    unavailableWeeks: arr(input.unavailableWeeks),
    unavailableMonths: arr(input.unavailableMonths).map(String),
    unavailableShiftsInWeeks: arr(input.unavailableShiftsInWeeks),
    unavailableShiftsInMonths: arr(input.unavailableShiftsInMonths),
    unavailableHolidays: arr(input.unavailableHolidays).map(String),
    fixedShifts: arr(input.fixedShifts),
  };
}

function params(n: Nurse) {
  return [
    n.code,
    n.name,
    n.generation,
    n.phone,
    JSON.stringify(n.unavailableDates),
    JSON.stringify(n.unavailableWeekdays),
    JSON.stringify(n.unavailableShifts),
    JSON.stringify(n.unavailableWeeks),
    JSON.stringify(n.unavailableMonths),
    JSON.stringify(n.unavailableShiftsInWeeks),
    JSON.stringify(n.unavailableShiftsInMonths),
    JSON.stringify(n.unavailableHolidays),
    JSON.stringify(n.fixedShifts),
  ];
}

const COLS =
  "code, name, generation, phone, unavailable_dates, unavailable_weekdays, unavailable_shifts, unavailable_weeks, unavailable_months, unavailable_shifts_in_weeks, unavailable_shifts_in_months, unavailable_holidays, fixed_shifts";

export function insertNurseStmt(n: Nurse): D1PreparedStatement {
  return db()
    .prepare(`INSERT INTO nurses (id, ${COLS}, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(n.id, ...params(n), nowIso());
}

/** เพิ่มหลายคนในคำสั่งเดียว (json_each) — ไม่ชนเพดานจำนวน query ต่อ request ของ D1 */
export function insertNursesStmt(list: Nurse[]): D1PreparedStatement {
  const cols = ["id", ...COLS.split(", ")];
  const select = cols.map((_, i) => `json_extract(value, '$[${i}]')`).join(", ");
  return db()
    .prepare(`INSERT INTO nurses (${cols.join(", ")}, updated_at) SELECT ${select}, ?1 FROM json_each(?2)`)
    .bind(nowIso(), JSON.stringify(list.map((n) => [n.id, ...params(n)])));
}

export function updateNurseStmt(n: Nurse): D1PreparedStatement {
  const set = COLS.split(", ").map((c) => `${c} = ?`).join(", ");
  return db().prepare(`UPDATE nurses SET ${set}, updated_at = ? WHERE id = ?`).bind(...params(n), nowIso(), n.id);
}

export function deleteNurseStmt(id: string): D1PreparedStatement {
  return db().prepare("DELETE FROM nurses WHERE id = ?").bind(id);
}

export async function codeTaken(code: string, exceptId?: string): Promise<boolean> {
  const r = await db().prepare("SELECT id FROM nurses WHERE code = ?").bind(code).first<{ id: string }>();
  return !!r && r.id !== exceptId;
}
