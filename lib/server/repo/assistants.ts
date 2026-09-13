import type { Assistant } from "../../types";
import { db, nowIso, parseJson } from "../db";
import { badRequest, str } from "../http";

interface Row {
  id: string;
  code: string;
  name: string;
  phone: string;
  unavailable_dates: string;
  unavailable_weekdays: string;
  unavailable_shifts: string;
}

const toAssistant = (r: Row): Assistant => ({
  id: r.id,
  code: r.code,
  name: r.name,
  phone: r.phone,
  unavailableDates: parseJson(r.unavailable_dates, []),
  unavailableWeekdays: parseJson(r.unavailable_weekdays, []),
  unavailableShifts: parseJson(r.unavailable_shifts, []),
});

export async function listAssistants(): Promise<Assistant[]> {
  const { results } = await db().prepare("SELECT * FROM assistants ORDER BY code").all<Row>();
  return results.map(toAssistant);
}

export async function getAssistant(id: string): Promise<Assistant | null> {
  const r = await db().prepare("SELECT * FROM assistants WHERE id = ?").bind(id).first<Row>();
  return r ? toAssistant(r) : null;
}

const arr = (v: unknown) => (Array.isArray(v) ? v : []);

export function sanitizeAssistant(input: Partial<Assistant>, id: string): Assistant {
  const code = str(input.code, 50);
  const name = str(input.name, 200);
  if (!code || !name) throw badRequest("กรุณากรอกรหัสและชื่อ");
  return {
    id,
    code,
    name,
    phone: str(input.phone, 50),
    unavailableDates: arr(input.unavailableDates).map(String),
    unavailableWeekdays: arr(input.unavailableWeekdays).map(Number).filter((n) => n >= 0 && n <= 6),
    unavailableShifts: arr(input.unavailableShifts).map(String).filter((s) => ["morning", "afternoon", "night"].includes(s)),
  };
}

export function upsertAssistantStmt(a: Assistant, insert: boolean): D1PreparedStatement {
  const vals = [a.code, a.name, a.phone, JSON.stringify(a.unavailableDates), JSON.stringify(a.unavailableWeekdays), JSON.stringify(a.unavailableShifts), nowIso()];
  return insert
    ? db()
        .prepare("INSERT INTO assistants (code, name, phone, unavailable_dates, unavailable_weekdays, unavailable_shifts, updated_at, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(...vals, a.id)
    : db()
        .prepare("UPDATE assistants SET code = ?, name = ?, phone = ?, unavailable_dates = ?, unavailable_weekdays = ?, unavailable_shifts = ?, updated_at = ? WHERE id = ?")
        .bind(...vals, a.id);
}

export async function assistantCodeTaken(code: string, exceptId?: string): Promise<boolean> {
  const r = await db().prepare("SELECT id FROM assistants WHERE code = ?").bind(code).first<{ id: string }>();
  return !!r && r.id !== exceptId;
}
