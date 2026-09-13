import { dateTH } from "../domain/dates";
import { SHIFT_LABELS, shiftLabelOf } from "../domain/schedule";

/** ข้อความสรุปภาษาไทยสำหรับหน้า Log */
export const FIELD_LABELS: Record<string, string> = {
  code: "รหัส",
  name: "ชื่อ",
  generation: "รุ่น",
  phone: "เบอร์โทร",
  unavailableDates: "วันไม่สะดวก",
  unavailableWeekdays: "วันในสัปดาห์ที่ไม่สะดวก",
  unavailableShifts: "กะที่ไม่สะดวก",
  unavailableWeeks: "สัปดาห์ที่ไม่สะดวก",
  unavailableMonths: "เดือนที่ไม่สะดวก",
  unavailableShiftsInWeeks: "กะไม่สะดวกรายสัปดาห์",
  unavailableShiftsInMonths: "กะไม่สะดวกรายเดือน",
  unavailableHolidays: "วันหยุดที่ไม่สะดวก",
  fixedShifts: "Fix เวร",
  fullname: "ชื่อ-นามสกุล",
  role: "บทบาท",
  nurseCode: "พยาบาลที่ผูก",
  assistantCode: "ผู้ช่วยที่ผูก",
  status: "สถานะ",
};

const short = (v: unknown) => {
  if (Array.isArray(v)) return v.length + " รายการ";
  const s = v === undefined || v === null || v === "" ? "-" : String(v);
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
};

export function changeSummary(prefix: string, before: Record<string, unknown>, after: Record<string, unknown>): string {
  const parts = Object.keys(after).map((k) => `${FIELD_LABELS[k] || k}: ${short(before[k])} → ${short(after[k])}`);
  return prefix + (parts.length ? " — " + parts.join(", ") : "");
}

export const shiftTH = (k: string) => SHIFT_LABELS[k] || shiftLabelOf(k);
export const d = (s: string) => dateTH(s);
