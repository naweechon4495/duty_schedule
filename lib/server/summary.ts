import { dateTH } from "../domain/dates";
import { SHIFT_LABELS, shiftLabelOf } from "../domain/schedule";

import { FIELD_LABELS } from "../domain/labels";

/** ข้อความสรุปภาษาไทยสำหรับหน้า Log */

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
