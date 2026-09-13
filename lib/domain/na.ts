import type { Assistant, DaySchedule, Holiday, MonthSchedule, NALeave, Schedule, Swap } from "../types";
import { MONTH_SHORT_TH, dateStrOf, daysInMonth, weekdayOf } from "./dates";
import { makeHolidayCalendar } from "./holidays";
import type { ShiftTone } from "./schedule";

export const NA_SHIFTS = ["morning", "morning_workday", "afternoon", "night"] as const;
export const NA_SHIFT_LABELS: Record<string, string> = { morning: "เช้า", morning_workday: "เช้าทำการ", afternoon: "บ่าย", night: "ดึก" };
export const NA_SHIFT_TONE: Record<string, ShiftTone> = { morning: "morning", morning_workday: "preop", afternoon: "afternoon", night: "night" };

export interface NAHeadcounts {
  morning: number;
  afternoon: number;
  night: number;
  morning_workday: number;
}
export const DEFAULT_NA_HEADCOUNTS: NAHeadcounts = { morning: 2, afternoon: 2, night: 2, morning_workday: 1 };

export function naHasAnyShift(ds: DaySchedule | undefined, id: string): boolean {
  return !!ds && NA_SHIFTS.some((k) => (ds[k] || []).includes(id));
}

export function naIsOnLeave(leaves: NALeave[], id: string, dateStr: string): boolean {
  return leaves.some((l) => l.assistantId === id && l.status === "approved" && dateStr >= l.dateFrom && dateStr <= (l.dateTo || l.dateFrom));
}

export function assistantUnavailable(a: Assistant, dateStr: string, shift?: string): boolean {
  if ((a.unavailableDates || []).includes(dateStr)) return true;
  if ((a.unavailableWeekdays || []).includes(weekdayOf(dateStr))) return true;
  if (shift && (a.unavailableShifts || []).includes(shift)) return true;
  return false;
}

export function matchAssistant(assistants: Assistant[], user: { assistantCode?: string; fullname?: string } | null): Assistant | null {
  if (!user) return null;
  const code = (user.assistantCode || "").trim();
  if (code) {
    const byCode = assistants.find((a) => (a.code || "").trim() === code);
    if (byCode) return byCode;
  }
  const fn = (user.fullname || "").trim();
  return fn ? assistants.find((a) => (a.name || "").trim() === fn) || null : null;
}

/**
 * จัดเวร NA อัตโนมัติ (port จาก autoScheduleNA)
 * วันหยุด: เช้า/บ่าย/ดึก | วันธรรมดา: เช้าทำการ/บ่าย/ดึก — จำนวนคนต่อกะตั้งได้
 * 1 คน 1 เวรต่อวัน, ห้ามบ่ายเมื่อวาน → ดึกวันนี้, เคารพวันลา/วันไม่สะดวก, เฉลี่ยจำนวนเวร (เท่ากันสุ่ม)
 */
export function autoScheduleNA(input: {
  month: string;
  assistants: Assistant[];
  leaves: NALeave[];
  holidays: Holiday[];
  headcounts: NAHeadcounts;
  random?: () => number;
}): { monthSchedule: MonthSchedule; warnings: string[]; totalAssigned: number } {
  const { month, assistants, leaves, headcounts } = input;
  const random = input.random ?? Math.random;
  const cal = makeHolidayCalendar(input.holidays);
  const [, m] = month.split("-").map(Number);
  const monthSchedule: MonthSchedule = {};
  const warnings: string[] = [];
  const load: Record<string, number> = Object.fromEntries(assistants.map((a) => [a.id, 0]));
  let prevAfternoon = new Set<string>();
  let total = 0;

  for (let d = 1; d <= daysInMonth(month); d++) {
    const dateStr = dateStrOf(month, d);
    const off = cal.isOffDay(dateStr);
    const day: DaySchedule = { morning: [], afternoon: [], night: [], morning_workday: [] };
    const assignedToday = new Set<string>();
    const todayAfternoon = new Set<string>();
    const shifts = off ? (["morning", "afternoon", "night"] as const) : (["morning_workday", "afternoon", "night"] as const);
    for (const shift of shifts) {
      const unavailKey = shift === "morning_workday" ? "morning" : shift;
      for (let k = 0; k < headcounts[shift]; k++) {
        const pool = assistants.filter(
          (a) =>
            !assignedToday.has(a.id) &&
            !naIsOnLeave(leaves, a.id, dateStr) &&
            !assistantUnavailable(a, dateStr, unavailKey) &&
            !(shift === "night" && prevAfternoon.has(a.id)),
        );
        if (!pool.length) {
          warnings.push(`${d} ${MONTH_SHORT_TH[m - 1]}: กะ${NA_SHIFT_LABELS[shift]}ได้ ${k}/${headcounts[shift]} คน`);
          break;
        }
        for (let x = pool.length - 1; x > 0; x--) {
          const j = Math.floor(random() * (x + 1));
          [pool[x], pool[j]] = [pool[j], pool[x]];
        }
        pool.sort((a, b) => load[a.id] - load[b.id]);
        const pick = pool[0];
        day[shift].push(pick.id);
        assignedToday.add(pick.id);
        load[pick.id]++;
        total++;
        if (shift === "afternoon") todayAfternoon.add(pick.id);
      }
    }
    monthSchedule[d] = day;
    prevAfternoon = todayAfternoon;
  }
  return { monthSchedule, warnings, totalAssigned: total };
}

/** อนุมัติแลก/ยกเวร NA: วันที่ date ย้าย from→to; แลกเวรคนละวัน: วันที่ date2 (กะเดียวกัน) ย้าย to→from */
export function applyNASwap(months: Record<string, MonthSchedule>, s: Swap): { first: boolean; second: boolean | null } {
  const rep = (dateStr: string, shift: string, a: string, b: string) => {
    const arr = months[dateStr.slice(0, 7)]?.[parseInt(dateStr.slice(8, 10), 10)]?.[shift];
    const i = arr ? arr.indexOf(a) : -1;
    if (i < 0 || !arr) return false;
    arr[i] = b;
    return true;
  };
  const first = rep(s.date, s.shift, s.from, s.to);
  const second = s.type !== "giveaway" && s.date2 && s.date2 !== s.date ? rep(s.date2, s.shift2 || s.shift, s.to, s.from) : null;
  return { first, second };
}

export function naCountMonth(ms: MonthSchedule | undefined, id: string) {
  const c = { morning: 0, morning_workday: 0, afternoon: 0, night: 0, total: 0 };
  if (!ms) return c;
  Object.values(ms).forEach((ds) =>
    NA_SHIFTS.forEach((k) => {
      if ((ds[k] || []).includes(id)) {
        c[k]++;
        c.total++;
      }
    }),
  );
  return c;
}

export function naShiftOnDate(schedule: Schedule, id: string, dateStr: string, shift: string): boolean {
  return !!schedule[dateStr.slice(0, 7)]?.[parseInt(dateStr.slice(8, 10), 10)]?.[shift]?.includes(id);
}
