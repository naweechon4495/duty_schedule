export const WEEKDAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
export const WEEKDAY_SHORT_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const MONTH_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export const MONTH_SHORT_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → 'YYYY-MM-DD' ตามเวลาท้องถิ่น (ไม่ใช้ toISOString ที่เลื่อนวันตาม UTC) */
export function fmtLocal(dt: Date): string {
  return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
}

export function monthKeyOf(dt: Date): string {
  return dt.getFullYear() + "-" + pad(dt.getMonth() + 1);
}

export function todayStr(): string {
  return fmtLocal(new Date());
}

export function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

export function dateStrOf(month: string, day: number): string {
  return month + "-" + pad(day);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** วันในสัปดาห์ของ 'YYYY-MM-DD' (0 = อาทิตย์) — parse แบบ local ไม่เลื่อนวัน */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return fmtLocal(new Date(y, m - 1, d + delta));
}

/** เลขสัปดาห์ของปี — สูตรเดียวกับระบบเดิม (ต้องตรงกันเพราะข้อมูล unavailableWeeks เก็บเลขนี้ไว้) */
export function getWeekNumber(dateStr: string): number {
  const dt = new Date(dateStr);
  const s = new Date(dt.getFullYear(), 0, 1);
  const days = Math.floor((dt.getTime() - s.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + s.getDay() + 1) / 7);
}

export function yearOf(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}

export function monthTitleTH(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return MONTH_TH[m - 1] + " " + (y + 543);
}

export function monthShortTH(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return MONTH_SHORT_TH[m - 1] + " " + (y + 543);
}

/** 'YYYY-MM-DD' → '14 ก.ย. 2569' */
export function dateTH(dateStr: string, withWeekday = false): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = d + " " + MONTH_SHORT_TH[m - 1] + " " + (y + 543);
  return withWeekday ? WEEKDAY_TH[weekdayOf(dateStr)] + " " + base : base;
}

/** ISO timestamp → '14 ก.ย. 2569 10:05' (เวลาไทย) */
export function dateTimeTH(iso: string): string {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
