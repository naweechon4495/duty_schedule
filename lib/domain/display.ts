import type { DaySchedule } from "../types";
import { customKeysOf, parseCustom, shiftTone, splitTeams, type ShiftTone } from "./schedule";

export interface ShiftGroup {
  /** ช่องสำหรับแก้ไข (morning1/afternoon2/night/preop/...) หรือ key ของเวรกำหนดเอง */
  slot: string;
  label: string;
  short: string;
  tone: ShiftTone;
  ids: string[];
  customKey?: string;
}

/** แยกตารางหนึ่งวันเป็นกลุ่มตามลำดับแสดงผล (เช้า 1/2, บ่าย 1/2, ดึก, Pre-op, เวรกำหนดเอง) */
export function dayGroups(ds: DaySchedule | undefined, opts: { includeEmpty?: string[] } = {}): ShiftGroup[] {
  if (!ds) return [];
  const [m1, m2] = splitTeams(ds.morning);
  const [a1, a2] = splitTeams(ds.afternoon);
  const std: ShiftGroup[] = [
    { slot: "morning1", label: "เช้า ทีม 1", short: "ช1", tone: "morning", ids: m1 },
    { slot: "morning2", label: "เช้า ทีม 2", short: "ช2", tone: "morning", ids: m2 },
    { slot: "afternoon1", label: "บ่าย ทีม 1", short: "บ1", tone: "afternoon", ids: a1 },
    { slot: "afternoon2", label: "บ่าย ทีม 2", short: "บ2", tone: "afternoon", ids: a2 },
    { slot: "night", label: "ดึก", short: "ด", tone: "night", ids: ds.night || [] },
    { slot: "preop_morning", label: "Pre-op เช้า", short: "Pช", tone: "preop", ids: ds.preop_morning || [] },
    { slot: "preop_afternoon", label: "Pre-op บ่าย", short: "Pบ", tone: "preop", ids: ds.preop_afternoon || [] },
    { slot: "preop", label: "Pre-op", short: "P", tone: "preop", ids: ds.preop || [] },
  ];
  const custom: ShiftGroup[] = customKeysOf(ds).map((k) => ({
    slot: k,
    customKey: k,
    label: parseCustom(k).name,
    short: parseCustom(k).name.slice(0, 3),
    tone: "custom",
    ids: ds[k] || [],
  }));
  const keep = new Set(opts.includeEmpty || []);
  return [...std, ...custom].filter((g) => g.ids.length > 0 || keep.has(g.slot));
}

export interface PersonShift {
  label: string;
  /** ป้ายสั้นสำหรับช่องปฏิทินบนมือถือ เช่น "บ่าย1" */
  short: string;
  tone: ShiftTone;
  oncall?: boolean;
}

/** ป้ายกะของคนหนึ่งในวันหนึ่ง เช่น ["เช้า 1", "ดึก"] พร้อมโทนสี */
export function personDayShifts(ds: DaySchedule | undefined, id: string): PersonShift[] {
  if (!ds) return [];
  const out: PersonShift[] = [];
  const mi = (ds.morning || []).indexOf(id);
  if (mi >= 0) out.push(mi < 3 ? { label: "เช้า 1", short: "เช้า1", tone: "morning" } : { label: "เช้า 2", short: "เช้า2", tone: "morning" });
  const ai = (ds.afternoon || []).indexOf(id);
  if (ai >= 0) out.push(ai < 3 ? { label: "บ่าย 1", short: "บ่าย1", tone: "afternoon" } : { label: "บ่าย 2", short: "บ่าย2", tone: "afternoon" });
  if ((ds.night || []).includes(id)) out.push({ label: "ดึก", short: "ดึก", tone: "night", oncall: (ds.night_oncall || []).includes(id) });
  if ((ds.preop_morning || []).includes(id)) out.push({ label: "Pre-op เช้า", short: "Pช", tone: "preop" });
  if ((ds.preop_afternoon || []).includes(id)) out.push({ label: "Pre-op บ่าย", short: "Pบ", tone: "preop" });
  if ((ds.preop || []).includes(id)) out.push({ label: "Pre-op", short: "Pre", tone: "preop" });
  customKeysOf(ds).forEach((k) => {
    if ((ds[k] || []).includes(id)) {
      const name = parseCustom(k).name;
      out.push({ label: name, short: name.slice(0, 4), tone: shiftTone(k) });
    }
  });
  return out;
}

const TITLE_RE = /^(นางสาว|นาง|นาย|น\.ส\.|นส\.|รตต\.|พญ\.|นพ\.|ดร\.)\s*/;

/** ชื่อสั้นสำหรับแสดงในปฏิทิน: ตัดคำนำหน้า เอาเฉพาะชื่อต้น */
export function shortName(name: string): string {
  const clean = name.trim().replace(TITLE_RE, "").trim();
  return clean.split(/\s+/)[0] || name;
}
