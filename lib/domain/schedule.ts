import type { DaySchedule, Leave, MonthSchedule, Nurse, Schedule } from "../types";
import { dateStrOf } from "./dates";

export const STD_SHIFTS = ["morning", "afternoon", "night", "preop", "preop_morning", "preop_afternoon"] as const;

/** สำรองตารางอัตโนมัติ (ก่อนจัดเวร/ล้าง/กู้คืน/Import) เก็บล่าสุดกี่ชุดต่อเดือน */
export const SNAPSHOT_AUTO_KEEP = 20;

export const SHIFT_LABELS: Record<string, string> = {
  morning: "เช้า",
  afternoon: "บ่าย",
  night: "ดึก",
  night_oncall: "ดึก On call",
  preop: "Pre-op",
  preop_morning: "Pre-op เช้า",
  preop_afternoon: "Pre-op บ่าย",
};

export const SLOT_LABELS: Record<string, string> = { morning: "เช้า", afternoon: "บ่าย", night: "ดึก" };

/** กลุ่มสีของกะ (ใช้ทั้งระบบ): morning=amber, afternoon=blue, night=slate, preop=violet, custom=purple */
export type ShiftTone = "morning" | "afternoon" | "night" | "preop" | "custom" | "leave";
export function shiftTone(key: string): ShiftTone {
  if (isCustomKey(key)) return "custom";
  if (key.startsWith("preop")) return "preop";
  if (key.startsWith("night")) return "night";
  if (key.startsWith("afternoon")) return "afternoon";
  return "morning";
}

export const GENERATIONS = ["1", "2", "3", "4", "staff"] as const;
export const GEN_LABELS: Record<string, string> = {
  "1": "รุ่น 1",
  "2": "รุ่น 2",
  "3": "รุ่น 3",
  "4": "รุ่น 4",
  staff: "Staff",
};

// ===== เวรกำหนดเอง: key = "slot|ชื่อเวร" =====
export function isCustomKey(k: string): boolean {
  return k.indexOf("|") >= 0;
}
export function parseCustom(k: string): { slot: string; name: string } {
  const i = k.indexOf("|");
  return { slot: k.slice(0, i), name: k.slice(i + 1) };
}
export function customKeysOf(ds: DaySchedule | undefined): string[] {
  return ds ? Object.keys(ds).filter(isCustomKey) : [];
}
export function shiftLabelOf(k: string): string {
  return isCustomKey(k) ? parseCustom(k).name : SHIFT_LABELS[k] || k;
}

export function emptyDay(): DaySchedule {
  return { morning: [], afternoon: [], night: [], night_oncall: [], preop: [], preop_morning: [], preop_afternoon: [] };
}

/** มีเวร (มาตรฐานหรือ custom) วันนั้นหรือไม่ — ไม่นับ night_oncall (เป็น subset ของ night) */
export function hasAnyShift(ds: DaySchedule | undefined, id: string): boolean {
  if (!ds) return false;
  for (const k of STD_SHIFTS) if ((ds[k] || []).includes(id)) return true;
  for (const k of customKeysOf(ds)) if ((ds[k] || []).includes(id)) return true;
  return false;
}

export function getDay(schedule: Schedule, dateStr: string): DaySchedule | undefined {
  const mk = dateStr.slice(0, 7);
  const dn = parseInt(dateStr.slice(8, 10), 10);
  return schedule[mk]?.[dn];
}

export function hasShiftOnDate(schedule: Schedule, id: string, dateStr: string, shift: string): boolean {
  const ds = getDay(schedule, dateStr);
  return !!(ds && Array.isArray(ds[shift]) && ds[shift].includes(id));
}

/** กะของคนหนึ่งในวันหนึ่ง (ไม่รวม night_oncall) */
export function shiftsOf(ds: DaySchedule | undefined, id: string): string[] {
  if (!ds) return [];
  return [...STD_SHIFTS.filter((k) => (ds[k] || []).includes(id)), ...customKeysOf(ds).filter((k) => (ds[k] || []).includes(id))];
}

/** ทีมของกะเช้า/บ่าย: 3 คนแรก = ทีม 1, ที่เหลือ = ทีม 2 */
export function splitTeams(ids: string[] | undefined): [string[], string[]] {
  const arr = ids || [];
  return [arr.slice(0, 3), arr.slice(3)];
}

export function isOnLeave(leaves: Pick<Leave, "nurseId" | "status" | "dateFrom" | "dateTo">[], nurseId: string, dateStr: string): boolean {
  return leaves.some(
    (l) => l.nurseId === nurseId && l.status === "approved" && dateStr >= l.dateFrom && dateStr <= (l.dateTo || l.dateFrom),
  );
}

/** เชื่อมบัญชี ↔ พยาบาล: ใช้ nurseCode ก่อน แล้วค่อยเทียบชื่อ-นามสกุล (เหมือนระบบเดิม) */
export function matchNurse(nurses: Nurse[], user: { nurseCode?: string; fullname?: string } | null): Nurse | null {
  if (!user) return null;
  const code = (user.nurseCode || "").trim();
  if (code) {
    const byCode = nurses.find((n) => (n.code || "").trim() === code);
    if (byCode) return byCode;
  }
  const fn = (user.fullname || "").trim();
  if (!fn) return null;
  return nurses.find((n) => (n.name || "").trim() === fn) || null;
}

/** จำนวนกะต่อชนิดของคนหนึ่งในเดือน */
export function countMonth(ms: MonthSchedule | undefined, id: string) {
  const c = { morning: 0, afternoon: 0, night: 0, oncall: 0, preop: 0, custom: 0, total: 0 };
  if (!ms) return c;
  Object.values(ms).forEach((ds) => {
    if ((ds.morning || []).includes(id)) c.morning++;
    if ((ds.afternoon || []).includes(id)) c.afternoon++;
    if ((ds.night || []).includes(id)) c.night++;
    if ((ds.night_oncall || []).includes(id)) c.oncall++;
    if ((ds.preop || []).includes(id) || (ds.preop_morning || []).includes(id) || (ds.preop_afternoon || []).includes(id)) c.preop++;
    customKeysOf(ds).forEach((k) => {
      if ((ds[k] || []).includes(id)) c.custom++;
    });
  });
  c.total = c.morning + c.afternoon + c.night + c.preop;
  return c;
}

/** ย้ายคนในกะ (ใช้ตอนอนุมัติแลกเวร/ใส่คนแทน) — ถ้าเป็นกะดึกและเป็น On call ก็ย้าย On call ตามไปด้วย */
export function replaceInShift(ds: DaySchedule, shift: string, fromId: string, toId: string): boolean {
  const arr = ds[shift];
  if (!arr) return false;
  const idx = arr.indexOf(fromId);
  if (idx < 0) return false;
  arr[idx] = toId;
  if (shift === "night" && ds.night_oncall) {
    const oi = ds.night_oncall.indexOf(fromId);
    if (oi >= 0) ds.night_oncall[oi] = toId;
  }
  return true;
}

export function monthDates(month: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => dateStrOf(month, i + 1));
}
