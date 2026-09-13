import type { Holiday } from "../types";
import { weekdayOf } from "./dates";

export const OFFICIAL_HOLIDAYS: Record<string, Holiday[]> = {
  "2025": [
    { date: "2025-01-01", name: "วันขึ้นปีใหม่" }, { date: "2025-02-12", name: "วันมาฆบูชา" },
    { date: "2025-04-06", name: "วันจักรี" }, { date: "2025-04-13", name: "วันสงกรานต์" },
    { date: "2025-04-14", name: "วันสงกรานต์" }, { date: "2025-04-15", name: "วันสงกรานต์" },
    { date: "2025-05-01", name: "วันแรงงาน" }, { date: "2025-05-04", name: "วันฉัตรมงคล" },
    { date: "2025-05-05", name: "วันฉัตรมงคล (ชดเชย)" }, { date: "2025-05-11", name: "วันวิสาขบูชา" },
    { date: "2025-05-12", name: "วันวิสาขบูชา (ชดเชย)" }, { date: "2025-06-02", name: "วันเฉลิมพระชนมพรรษาพระราชินี" },
    { date: "2025-06-03", name: "วันเฉลิมพระชนมพรรษาพระราชินี (ชดเชย)" }, { date: "2025-07-10", name: "วันอาสาฬหบูชา" },
    { date: "2025-07-28", name: "วันเฉลิมพระชนมพรรษา ร.10" }, { date: "2025-08-12", name: "วันแม่แห่งชาติ" },
    { date: "2025-10-13", name: "วันคล้ายวันสวรรคต ร.9" }, { date: "2025-10-23", name: "วันปิยมหาราช" },
    { date: "2025-12-05", name: "วันพ่อแห่งชาติ" }, { date: "2025-12-10", name: "วันรัฐธรรมนูญ" },
    { date: "2025-12-31", name: "วันสิ้นปี" },
  ],
  "2026": [
    { date: "2026-01-01", name: "วันขึ้นปีใหม่" }, { date: "2026-02-16", name: "วันมาฆบูชา" },
    { date: "2026-04-06", name: "วันจักรี" }, { date: "2026-04-13", name: "วันสงกรานต์" },
    { date: "2026-04-14", name: "วันสงกรานต์" }, { date: "2026-04-15", name: "วันสงกรานต์" },
    { date: "2026-05-01", name: "วันแรงงาน" }, { date: "2026-05-04", name: "วันฉัตรมงคล" },
    { date: "2026-05-05", name: "วันฉัตรมงคล (ชดเชย)" }, { date: "2026-06-01", name: "วันเฉลิมพระชนมพรรษาพระราชินี" },
    { date: "2026-06-02", name: "วันวิสาขบูชา" }, { date: "2026-07-27", name: "วันอาสาฬหบูชา" },
    { date: "2026-07-28", name: "วันเฉลิมพระชนมพรรษา ร.10" }, { date: "2026-08-12", name: "วันแม่แห่งชาติ" },
    { date: "2026-10-13", name: "วันคล้ายวันสวรรคต ร.9" }, { date: "2026-10-23", name: "วันปิยมหาราช" },
    { date: "2026-12-05", name: "วันพ่อแห่งชาติ" }, { date: "2026-12-10", name: "วันรัฐธรรมนูญ" },
    { date: "2026-12-31", name: "วันสิ้นปี" },
  ],
  "2027": [
    { date: "2027-01-01", name: "วันขึ้นปีใหม่" }, { date: "2027-02-05", name: "วันมาฆบูชา" },
    { date: "2027-04-06", name: "วันจักรี" }, { date: "2027-04-13", name: "วันสงกรานต์" },
    { date: "2027-04-14", name: "วันสงกรานต์" }, { date: "2027-04-15", name: "วันสงกรานต์" },
    { date: "2027-05-01", name: "วันแรงงาน" }, { date: "2027-05-20", name: "วันวิสาขบูชา" },
    { date: "2027-05-21", name: "วันวิสาขบูชา (ชดเชย)" }, { date: "2027-05-31", name: "วันเฉลิมพระชนมพรรษาพระราชินี" },
    { date: "2027-06-01", name: "วันเฉลิมพระชนมพรรษาพระราชินี (ชดเชย)" }, { date: "2027-07-17", name: "วันอาสาฬหบูชา" },
    { date: "2027-07-27", name: "วันเฉลิมพระชนมพรรษา ร.10" }, { date: "2027-08-12", name: "วันแม่แห่งชาติ" },
    { date: "2027-10-13", name: "วันคล้ายวันสวรรคต ร.9" }, { date: "2027-10-23", name: "วันปิยมหาราช" },
    { date: "2027-12-05", name: "วันพ่อแห่งชาติ" }, { date: "2027-12-10", name: "วันรัฐธรรมนูญ" },
    { date: "2027-12-31", name: "วันสิ้นปี" },
  ],
};

export const HOLIDAY_YEARS = Object.keys(OFFICIAL_HOLIDAYS);

/**
 * ตัวช่วยตรวจวันหยุด ผูกกับรายการวันหยุดพิเศษ (custom) ชุดหนึ่ง
 * สร้างครั้งเดียวแล้วใช้ซ้ำ เพื่อไม่ต้องส่ง customHolidays ไปทุกฟังก์ชัน
 */
export interface HolidayCalendar {
  isOfficialHoliday(date: string): boolean;
  isCustomHoliday(date: string): boolean;
  isHoliday(date: string): boolean;
  isWeekend(date: string): boolean;
  isOffDay(date: string): boolean;
  holidayName(date: string): string;
  all(): (Holiday & { type: "official" | "custom" })[];
}

export function makeHolidayCalendar(customHolidays: Holiday[]): HolidayCalendar {
  const official = new Map<string, string>();
  Object.values(OFFICIAL_HOLIDAYS).forEach((list) => list.forEach((h) => official.set(h.date, h.name)));
  const custom = new Map(customHolidays.map((h) => [h.date, h.name]));
  const isWeekend = (d: string) => {
    const w = weekdayOf(d);
    return w === 0 || w === 6;
  };
  const cal: HolidayCalendar = {
    isOfficialHoliday: (d) => official.has(d),
    isCustomHoliday: (d) => custom.has(d),
    isHoliday: (d) => official.has(d) || custom.has(d),
    isWeekend,
    isOffDay: (d) => isWeekend(d) || official.has(d) || custom.has(d),
    holidayName: (d) => official.get(d) || custom.get(d) || "",
    all: () => {
      const out: (Holiday & { type: "official" | "custom" })[] = [];
      official.forEach((name, date) => out.push({ date, name, type: "official" }));
      custom.forEach((name, date) => {
        if (!official.has(date)) out.push({ date, name, type: "custom" });
      });
      return out.sort((a, b) => a.date.localeCompare(b.date));
    },
  };
  return cal;
}
