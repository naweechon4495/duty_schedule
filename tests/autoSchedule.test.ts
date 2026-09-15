import { describe, expect, it } from "vitest";
import { MAX_NIGHT_STREAK, autoSchedule } from "../lib/domain/autoSchedule";
import { dateStrOf, daysInMonth } from "../lib/domain/dates";
import { makeHolidayCalendar } from "../lib/domain/holidays";
import { STD_SHIFTS } from "../lib/domain/schedule";
import type { Generation, MonthSchedule, Nurse } from "../lib/types";

// ข้อมูลสมมติ จำนวนคนต่อรุ่นใกล้เคียงข้อมูลจริง (ไม่ใช้ชื่อจริง)
function makeNurses(plan: [Generation, number][] = [["1", 13], ["2", 8], ["3", 9], ["4", 13]]): Nurse[] {
  const out: Nurse[] = [];
  let i = 1;
  for (const [gen, count] of plan) {
    for (let k = 0; k < count; k++, i++) {
      out.push({
        id: "T" + i,
        code: "T" + String(i).padStart(3, "0"),
        name: "ทดสอบ " + i,
        generation: gen,
        phone: "",
        unavailableDates: [],
        unavailableWeekdays: [],
        unavailableShifts: [],
        unavailableWeeks: [],
        unavailableMonths: [],
        unavailableShiftsInWeeks: [],
        unavailableShiftsInMonths: [],
        unavailableHolidays: [],
        fixedShifts: [],
      });
    }
  }
  // ข้อจำกัดบางคน: ทำงานเฉพาะวันธรรมดา
  out[0].unavailableWeekdays = [0, 6];
  out[1].unavailableWeekdays = [0, 6];
  return out;
}

const seeded = () => {
  let s = 42;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

function run(month: string) {
  const nurses = makeNurses();
  const res = autoSchedule({ month, nurses, schedule: {}, leaves: [], holidays: [], random: seeded() });
  return { nurses, ...res };
}

const monthsToTest = ["2026-09", "2026-10", "2027-02"];

describe("autoSchedule", () => {
  it.each(monthsToTest)("ไม่มีบ่ายควบดึก (บ่ายเมื่อวาน → ดึกวันนี้) — %s", (month) => {
    const { monthSchedule } = run(month);
    for (let d = 2; d <= daysInMonth(month); d++) {
      const prevAft = monthSchedule[d - 1].afternoon;
      monthSchedule[d].night.forEach((id) => expect(prevAft).not.toContain(id));
    }
  });

  it("ดึกห้ามติดกัน (MAX_NIGHT_STREAK = 1)", () => {
    expect(MAX_NIGHT_STREAK).toBe(1);
  });

  it("คนในรุ่นไม่พอจนต้องให้ดึกติด → มีคำเตือนทุกครั้ง", () => {
    const month = "2026-10";
    const nurses = makeNurses([["1", 3], ["2", 9], ["3", 8], ["4", 12]]);
    const { monthSchedule, warnings } = autoSchedule({ month, nurses, schedule: {}, leaves: [], holidays: [], random: seeded() });
    let forced = 0;
    for (let d = 2; d <= daysInMonth(month); d++) {
      for (const id of monthSchedule[d].night) {
        if (!monthSchedule[d - 1].night.includes(id)) continue;
        forced++;
        const name = nurses.find((n) => n.id === id)!.name;
        expect(warnings.some((w) => w.startsWith(d + " ") && w.includes(name + " ลงดึกติดกัน"))).toBe(true);
      }
    }
    expect(forced).toBeGreaterThan(0);
  });

  it.each(monthsToTest)("ลงดึกติดกันไม่เกิน %i วัน — %s".replace("%i", String(MAX_NIGHT_STREAK)), (month) => {
    const { monthSchedule, nurses } = run(month);
    for (const n of nurses) {
      let streak = 0;
      for (let d = 1; d <= daysInMonth(month); d++) {
        streak = monthSchedule[d].night.includes(n.id) ? streak + 1 : 0;
        expect(streak).toBeLessThanOrEqual(MAX_NIGHT_STREAK);
      }
    }
  });

  it.each(monthsToTest)("ทีมละ 3 คนคนละรุ่น + วันหยุด 1 คน 1 เวร — %s", (month) => {
    const { monthSchedule, nurses } = run(month);
    const gen = Object.fromEntries(nurses.map((n) => [n.id, n.generation]));
    const cal = makeHolidayCalendar([]);
    for (let d = 1; d <= daysInMonth(month); d++) {
      const ds = monthSchedule[d];
      const teams = [ds.night, ds.afternoon.slice(0, 3), ds.afternoon.slice(3), ds.morning.slice(0, 3), ds.morning.slice(3)];
      for (const t of teams) if (t.length) expect(new Set(t.map((id) => gen[id])).size).toBe(t.length);
      if (cal.isOffDay(dateStrOf(month, d))) {
        const all = STD_SHIFTS.flatMap((k) => ds[k] || []);
        expect(new Set(all).size).toBe(all.length);
      }
    }
  });

  it("จัดซ้ำได้ผลเดิม (ยกเว้น On call ที่สุ่ม)", () => {
    const strip = (ms: MonthSchedule) =>
      JSON.stringify(Object.fromEntries(Object.entries(ms).map(([d, ds]) => [d, { ...ds, night_oncall: [] }])));
    expect(strip(run("2026-09").monthSchedule)).toBe(strip(run("2026-09").monthSchedule));
  });

  it.each(monthsToTest)("จำนวนเวรรวมภายในรุ่นห่างกันไม่เกิน 3 — %s", (month) => {
    const { monthSchedule, nurses } = run(month);
    const total: Record<string, number> = {};
    Object.values(monthSchedule).forEach((ds) => STD_SHIFTS.forEach((k) => (ds[k] || []).forEach((id) => (total[id] = (total[id] || 0) + 1))));
    for (const g of ["1", "2", "3", "4"]) {
      // ไม่นับคนที่ติดข้อจำกัดวันทำงาน
      const t = nurses.filter((n) => n.generation === g && n.unavailableWeekdays.length === 0).map((n) => total[n.id] || 0);
      expect(Math.max(...t) - Math.min(...t)).toBeLessThanOrEqual(3);
    }
  });
});
