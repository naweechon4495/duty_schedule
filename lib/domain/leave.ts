import type { Leave, Nurse, Schedule } from "../types";
import { fmtLocal } from "./dates";
import { STD_SHIFTS, customKeysOf, getDay, hasAnyShift, isOnLeave } from "./schedule";

export const LEAVE_TYPES: Record<string, string> = { personal: "ลากิจ", sick: "ลาป่วย", vacation: "ลาพักร้อน" };

/** วันทั้งหมดในช่วงลา (สูงสุด 400 วัน กันข้อมูลผิด) */
export function leaveDates(l: Pick<Leave, "dateFrom" | "dateTo">): string[] {
  const out: string[] = [];
  const to = l.dateTo || l.dateFrom;
  const [fy, fm, fd] = l.dateFrom.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(fmtLocal(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}

/** เวรที่ทับกับช่วงลา */
export function affectedShifts(schedule: Schedule, l: Pick<Leave, "nurseId" | "dateFrom" | "dateTo">): { dateStr: string; shift: string }[] {
  const res: { dateStr: string; shift: string }[] = [];
  leaveDates(l).forEach((dateStr) => {
    const ds = getDay(schedule, dateStr);
    if (!ds) return;
    [...STD_SHIFTS, ...customKeysOf(ds)].forEach((k) => {
      if ((ds[k] || []).includes(l.nurseId)) res.push({ dateStr, shift: k });
    });
  });
  return res;
}

function countShiftsInWindow(schedule: Schedule, id: string, center: string, radius: number): number {
  const [cy, cm, cd] = center.split("-").map(Number);
  let cnt = 0;
  for (let off = -radius; off <= radius; off++) {
    const s = fmtLocal(new Date(cy, cm - 1, cd + off));
    if (hasAnyShift(getDay(schedule, s), id)) cnt++;
  }
  return cnt;
}

function countShiftsInMonth(schedule: Schedule, id: string, mk: string): number {
  let c = 0;
  const ms = schedule[mk] || {};
  for (const d in ms) if (hasAnyShift(ms[d], id)) c++;
  return c;
}

/** แนะนำคนขึ้นแทน: ว่างวันนั้น + ไม่ลา เรียงตามเวรใน ±3 วันน้อยสุด (รุ่นเดียวกันก่อน) สูงสุด 3 คน */
export function suggestReplacement(
  schedule: Schedule,
  nurses: Nurse[],
  leaves: Leave[],
  dateStr: string,
  sickId: string,
): { nurse: Nurse; load: number; month: number }[] {
  const ds = getDay(schedule, dateStr);
  if (!ds) return [];
  const sick = nurses.find((n) => n.id === sickId);
  const pool = nurses.filter((n) => n.id !== sickId && !hasAnyShift(ds, n.id) && !isOnLeave(leaves, n.id, dateStr));
  const sameGen = sick ? pool.filter((n) => n.generation === sick.generation) : [];
  const use = sameGen.length ? sameGen : pool;
  const mk = dateStr.slice(0, 7);
  return use
    .map((n) => ({ nurse: n, load: countShiftsInWindow(schedule, n.id, dateStr, 3), month: countShiftsInMonth(schedule, n.id, mk) }))
    .sort((a, b) => a.load - b.load || a.month - b.month || (a.nurse.code || "").localeCompare(b.nurse.code || ""))
    .slice(0, 3);
}
