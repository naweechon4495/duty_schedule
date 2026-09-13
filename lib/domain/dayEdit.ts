import type { DaySchedule } from "../types";
import { emptyDay, splitTeams } from "./schedule";

/** ช่องที่แอดมินแก้ได้ในหน้ารายละเอียดวัน (เช้า/บ่ายแยกทีม 1/2) */
export const EDIT_SLOTS = ["morning1", "morning2", "afternoon1", "afternoon2", "night", "preop", "preop_morning", "preop_afternoon"] as const;
export type EditSlot = (typeof EDIT_SLOTS)[number];

export const EDIT_SLOT_LABELS: Record<EditSlot, string> = {
  morning1: "เช้า ทีม 1",
  morning2: "เช้า ทีม 2",
  afternoon1: "บ่าย ทีม 1",
  afternoon2: "บ่าย ทีม 2",
  night: "ดึก",
  preop: "Pre-op",
  preop_morning: "Pre-op เช้า",
  preop_afternoon: "Pre-op บ่าย",
};

export type DayEdit =
  | { op: "create" }
  | { op: "add"; slot: EditSlot; personId: string }
  | { op: "remove"; slot: EditSlot; personId: string }
  | { op: "toggle_oncall"; personId: string }
  | { op: "remove_custom"; key: string };

export class DayEditError extends Error {}

/** แก้ตารางหนึ่งวัน (port จาก adminAddToShift / adminRemoveFromShift / adminToggleOncall) — คืนวันใหม่ ไม่แก้ของเดิม */
export function applyDayEdit(current: DaySchedule | undefined, e: DayEdit): DaySchedule {
  const ds: DaySchedule = current ? JSON.parse(JSON.stringify(current)) : emptyDay();
  if (e.op === "create") return ds;

  if (e.op === "remove_custom") {
    delete ds[e.key];
    return ds;
  }

  if (e.op === "toggle_oncall") {
    if (!(ds.night || []).includes(e.personId)) throw new DayEditError("ต้องอยู่กะดึกก่อนจึงจะเป็น On call ได้");
    const oc = ds.night_oncall || [];
    ds.night_oncall = oc.includes(e.personId) ? oc.filter((x) => x !== e.personId) : [e.personId]; // On call 1 คนต่อกะ
    return ds;
  }

  const base = e.slot.startsWith("morning") ? "morning" : e.slot.startsWith("afternoon") ? "afternoon" : null;
  if (e.op === "add") {
    if (base) {
      const arr = ds[base] || [];
      if (arr.includes(e.personId)) throw new DayEditError("คนนี้อยู่ในกะนี้แล้ว");
      const [t1, t2] = splitTeams(arr);
      if (e.slot.endsWith("1")) {
        if (t1.length >= 3) throw new DayEditError("ทีม 1 เต็มแล้ว (3 คน)");
        t1.push(e.personId);
      } else {
        if (t2.length >= 3) throw new DayEditError("ทีม 2 เต็มแล้ว (3 คน)");
        t2.push(e.personId);
      }
      ds[base] = [...t1, ...t2];
    } else {
      const arr = ds[e.slot] || [];
      if (arr.includes(e.personId)) throw new DayEditError("คนนี้อยู่ในกะนี้แล้ว");
      ds[e.slot] = [...arr, e.personId];
    }
    return ds;
  }

  // remove
  if (base) {
    let [t1, t2] = splitTeams(ds[base]);
    if (e.slot.endsWith("1")) t1 = t1.filter((x) => x !== e.personId);
    else t2 = t2.filter((x) => x !== e.personId);
    ds[base] = [...t1, ...t2];
  } else {
    ds[e.slot] = (ds[e.slot] || []).filter((x) => x !== e.personId);
  }
  if (e.slot === "night") ds.night_oncall = (ds.night_oncall || []).filter((x) => x !== e.personId);
  return ds;
}
