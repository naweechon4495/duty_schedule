import type { DaySchedule, Generation, Holiday, Leave, MonthSchedule, Nurse, Schedule } from "../types";
import { MONTH_SHORT_TH, dateStrOf, daysInMonth as dim, fmtLocal, getWeekNumber, weekdayOf, yearOf } from "./dates";
import { makeHolidayCalendar } from "./holidays";
import { STD_SHIFTS, emptyDay, hasAnyShift, isOnLeave } from "./schedule";
import { leaveDates } from "./leave";

/**
 * จัดเวรอัตโนมัติ 1 เดือน (port จากระบบเดิม legacy/public/index.html → autoSchedule)
 *
 * เงื่อนไขหลัก
 * - วันธรรมดา: บ่าย 2 ทีม (6 คน) + ดึก 1 ทีม (3 คน) + Pre-op 1 คน | วันหยุด: + เช้า 2 ทีม + Pre-op เช้า/บ่าย
 * - ทีมละ 3 คนคนละรุ่น, รุ่น 4 = Pre-op, Staff ได้เช้าวันหยุด 3 เวร/เดือน
 * - เฉลี่ยภาระรวมของเดือนนี้ก่อน → จำนวนกะชนิดนี้/ทีม → ประวัติเดือนก่อน
 * - ห้ามบ่ายควบดึก (บ่ายเมื่อวาน → ห้ามดึกวันนี้) เด็ดขาด, ดึกติดกันไม่เกิน 2 วัน, เมื่อวานหยุดลงดึกได้
 * - บ่ายห้ามติด 3 วัน (ผ่อนได้ถ้าคนไม่พอ), วันธรรมดาดึก/บ่ายไม่ใช่คนเดียวกัน, วันหยุด 1 คน 1 เวร
 */
export interface AutoScheduleInput {
  month: string;
  nurses: Nurse[];
  /** ตารางทั้งหมดที่มีอยู่ (ใช้ดูเดือนก่อนหน้าเพื่อความต่อเนื่อง + ประวัติ) */
  schedule: Schedule;
  leaves: Leave[];
  holidays: Holiday[];
  /** ใช้สุ่ม On call — ส่งค่าคงที่ได้ตอนทดสอบ */
  random?: () => number;
}

export interface AutoScheduleResult {
  monthSchedule: MonthSchedule;
  warnings: string[];
  totalAssigned: number;
}

export const MAX_NIGHT_STREAK = 2;

type TypeKey = "morning1" | "morning2" | "afternoon1" | "afternoon2" | "night" | "preop";

export function autoSchedule(input: AutoScheduleInput): AutoScheduleResult {
  const { month, nurses, schedule, leaves } = input;
  const random = input.random ?? Math.random;
  const cal = makeHolidayCalendar(input.holidays);
  const [y, m] = month.split("-").map(Number);
  const days = dim(month);
  const monthSched: MonthSchedule = {};
  const warnings: string[] = [];

  const shiftTypeKey = (st: string): TypeKey => (st.indexOf("preop") === 0 ? "preop" : (st as TypeKey));
  const totalShifts: Record<string, number> = {};
  const typeShifts: Record<string, Record<TypeKey, number>> = {};
  const histShifts: Record<string, number> = {};
  nurses.forEach((n) => {
    totalShifts[n.id] = 0;
    histShifts[n.id] = 0;
    typeShifts[n.id] = { morning1: 0, morning2: 0, afternoon1: 0, afternoon2: 0, night: 0, preop: 0 };
  });
  Object.keys(schedule).forEach((mk) => {
    if (mk >= month) return;
    Object.values(schedule[mk]).forEach((ds) => {
      STD_SHIFTS.forEach((k) => (ds[k] || []).forEach((id) => {
        if (histShifts[id] !== undefined) histShifts[id]++;
      }));
    });
  });
  const staffMornTotal = (id: string) => typeShifts[id].morning1 + typeShifts[id].morning2;

  // ลาพักร้อน: ลดโควตา 1 เวร ต่อวันลา 3 วัน
  const vacDays: Record<string, number> = {};
  leaves.forEach((l) => {
    if (l.type === "vacation" && l.status === "approved" && totalShifts[l.nurseId] !== undefined) {
      leaveDates(l).forEach((ds) => {
        if (ds.slice(0, 7) === month) vacDays[l.nurseId] = (vacDays[l.nurseId] || 0) + 1;
      });
    }
  });
  const vacHandicap: Record<string, number> = {};
  Object.keys(vacDays).forEach((id) => (vacHandicap[id] = Math.floor(vacDays[id] / 3)));

  let assignedToday = new Set<string>();
  const assign = (n: Nurse, shiftKey: string) => {
    const tk = shiftTypeKey(shiftKey);
    totalShifts[n.id]++;
    typeShifts[n.id][tk]++;
    assignedToday.add(n.id);
  };
  const label = (d: number) => d + " " + MONTH_SHORT_TH[m - 1];

  for (let d = 1; d <= days; d++) {
    const dateStr = dateStrOf(month, d);
    const offDay = cal.isOffDay(dateStr);
    const dow = weekdayOf(dateStr);
    const daySched = emptyDay();
    assignedToday = new Set();

    const unavailable = new Set<string>();
    const weekNum = getWeekNumber(dateStr);
    const year = yearOf(dateStr);
    nurses.forEach((n) => {
      if (n.unavailableDates?.includes(dateStr)) unavailable.add(n.id);
      if (n.unavailableHolidays?.includes(dateStr)) unavailable.add(n.id);
      if (n.unavailableWeekdays?.includes(dow)) unavailable.add(n.id);
      if (n.unavailableWeeks?.some((w) => w.year === year && w.week === weekNum)) unavailable.add(n.id);
      if (n.unavailableMonths?.includes(month)) unavailable.add(n.id);
      if (isOnLeave(leaves, n.id, dateStr)) unavailable.add(n.id);
    });

    // 📌 Fix เวร: ล็อกเข้ากะนั้น และกันไม่ให้ถูกดึงไปกะอื่น
    const fixedByShift: Record<string, Nurse[]> = { morning: [], afternoon: [], night: [], preop: [], preop_morning: [], preop_afternoon: [] };
    nurses.forEach((n) => {
      (n.fixedShifts || []).forEach((f) => {
        if (f.date === dateStr && fixedByShift[f.shift] && !isOnLeave(leaves, n.id, dateStr) && !fixedByShift[f.shift].some((x) => x.id === n.id)) {
          fixedByShift[f.shift].push(n);
        }
      });
    });
    Object.values(fixedByShift).forEach((arr) => arr.forEach((n) => unavailable.add(n.id)));

    const schedDaysAgo = (k: number): DaySchedule | undefined => {
      const pd = new Date(y, m - 1, d - k);
      const pk = pd.getFullYear() + "-" + String(pd.getMonth() + 1).padStart(2, "0");
      return pk === month ? monthSched[pd.getDate()] : schedule[pk]?.[pd.getDate()];
    };
    const prevIsOff = cal.isOffDay(fmtLocal(new Date(y, m - 1, d - 1)));
    const prevSched = schedDaysAgo(1);
    const prevAfternoon = new Set(prevSched ? prevSched.afternoon || [] : []);
    const prevSched2 = schedDaysAgo(2);
    const prev2Afternoon = new Set(prevSched2 ? prevSched2.afternoon || [] : []);
    const nightStreak = (id: string) => {
      let s = 0;
      while (s < MAX_NIGHT_STREAK) {
        const ds = schedDaysAgo(s + 1);
        if (ds && (ds.night || []).includes(id)) s++;
        else break;
      }
      return s;
    };
    // ความเหมาะสมลงดึก (น้อย = เหมาะกว่า); null = บ่ายเมื่อวาน ห้ามเด็ดขาด
    // 0 ต่อบล็อกดึก | 1 เมื่อวานมีเวรอื่น | 2 เมื่อวานหยุด | 3 บ่ายเมื่อวานซืน+หยุดเมื่อวาน | 4 ดึกติดครบแล้ว
    const nightRank: Record<string, number | null> = {};
    nurses.forEach((n) => {
      const st = nightStreak(n.id);
      if (prevAfternoon.has(n.id)) nightRank[n.id] = null;
      else if (st >= MAX_NIGHT_STREAK) nightRank[n.id] = 4;
      else if (st > 0) nightRank[n.id] = 0;
      else if (prevSched && hasAnyShift(prevSched, n.id)) nightRank[n.id] = 1;
      else nightRank[n.id] = prev2Afternoon.has(n.id) ? 3 : 2;
    });

    const unavailableShifts: Record<string, Set<string>> = {};
    const addUS = (id: string, shift: string) => {
      (unavailableShifts[id] ||= new Set()).add(shift);
    };
    nurses.forEach((n) => {
      (n.unavailableShifts || []).forEach((s) => {
        if (s.date === dateStr) addUS(n.id, s.shift);
      });
      (n.unavailableShiftsInWeeks || []).forEach((w) => {
        if (w.year === year && w.week === weekNum) addUS(n.id, w.shift);
      });
      (n.unavailableShiftsInMonths || []).forEach((mo) => {
        if (mo.month === month) addUS(n.id, mo.shift);
      });
    });

    const load = (id: string) => (totalShifts[id] || 0) + (vacHandicap[id] || 0);
    const cmpBy = (tk: TypeKey) => (a: Nurse, b: Nurse) =>
      load(a.id) - load(b.id) || (typeShifts[a.id][tk] || 0) - (typeShifts[b.id][tk] || 0) || histShifts[a.id] - histShifts[b.id];
    const getAvailableByGen = (shiftType: string) => {
      const tk = shiftTypeKey(shiftType);
      const byGen: Record<Generation, Nurse[]> = { "1": [], "2": [], "3": [], "4": [], staff: [] };
      nurses.forEach((n) => {
        if (unavailable.has(n.id)) return;
        if (unavailableShifts[n.id]?.has(shiftType)) return;
        if (offDay && assignedToday.has(n.id)) return;
        (byGen[n.generation] ||= []).push(n);
      });
      (Object.keys(byGen) as Generation[]).forEach((g) => byGen[g].sort(cmpBy(tk)));
      return byGen;
    };

    // Pre-op (คน fix มาก่อน)
    const fillPreop = (key: "preop" | "preop_morning" | "preop_afternoon", warn: string) => {
      fixedByShift[key].forEach((n) => {
        daySched[key].push(n.id);
        assign(n, key);
      });
      if (daySched[key].length === 0) {
        const pool = getAvailableByGen(key);
        const p = pool["4"].shift();
        if (p) {
          daySched[key].push(p.id);
          assign(p, key);
        } else warnings.push(label(d) + ": ไม่มีพยาบาลรุ่น 4 สำหรับ " + warn);
      }
    };
    if (offDay) {
      fillPreop("preop_morning", "Pre-op เช้า");
      fillPreop("preop_afternoon", "Pre-op บ่าย");
    } else {
      fillPreop("preop", "Pre-op");
    }

    // กะดึก: 1 ทีม 3 คน (ไม่ซ้ำรุ่น) จากรุ่น 1-3
    const nightPool = getAvailableByGen("night");
    (["1", "2", "3"] as const).forEach((g) => {
      nightPool[g] = nightPool[g].filter((n) => nightRank[n.id] !== null).sort((a, b) => (nightRank[a.id] as number) - (nightRank[b.id] as number));
    });
    const nightTeam: Nurse[] = [...fixedByShift.night];
    (["1", "2", "3"] as const).forEach((g) => {
      if (nightTeam.length < 3 && nightPool[g].length > 0) nightTeam.push(nightPool[g].shift()!);
    });
    if (nightTeam.length < 3) {
      const remaining = [...nightPool["1"], ...nightPool["2"], ...nightPool["3"]].filter((n) => !nightTeam.includes(n));
      remaining.sort((a, b) => (nightRank[a.id] as number) - (nightRank[b.id] as number) || cmpBy("night")(a, b));
      while (nightTeam.length < 3 && remaining.length > 0) nightTeam.push(remaining.shift()!);
      if (nightTeam.length < 3) warnings.push(label(d) + ": กะดึกได้ " + nightTeam.length + "/3 คน (คนที่เหลือบ่ายเมื่อวาน/ไม่ว่าง)");
    }
    nightTeam.forEach((n) => {
      daySched.night.push(n.id);
      assign(n, "night");
    });
    if (nightTeam.length > 0) {
      daySched.night_oncall.push(nightTeam[Math.floor(random() * nightTeam.length)].id);
    }

    // กะเช้า: เฉพาะวันหยุด (2 ทีม) — staff ได้สิทธิ์ก่อน โควตา 3/เดือน สูงสุด 1 คน/ทีม
    if (offDay) {
      const staffElig = (n: Nurse) => staffMornTotal(n.id) < 3;
      const buildMorn = (tk: TypeKey, fixedList: Nurse[]) => {
        const pool = getAvailableByGen(tk);
        const team: Nurse[] = [];
        const uG = new Set<string>();
        fixedList.forEach((n) => {
          if (team.length < 3) {
            team.push(n);
            uG.add(n.generation);
          }
        });
        (pool.staff || []).filter(staffElig).sort(cmpBy(tk)).forEach((n) => {
          if (team.length < 3 && !uG.has("staff")) {
            team.push(n);
            uG.add("staff");
          }
        });
        (["1", "2", "3"] as const).flatMap((g) => pool[g] || []).sort(cmpBy(tk)).forEach((n) => {
          if (team.length < 3 && !uG.has(n.generation)) {
            team.push(n);
            uG.add(n.generation);
          }
        });
        return team;
      };
      buildMorn("morning1", fixedByShift.morning).forEach((n) => {
        daySched.morning.push(n.id);
        assign(n, "morning1");
      });
      buildMorn("morning2", []).forEach((n) => {
        daySched.morning.push(n.id);
        assign(n, "morning2");
      });
    }

    // กะบ่าย: 2 ทีมทุกวัน
    {
      const nightSet = new Set(daySched.night);
      const consecSoft = !offDay && !prevIsOff;
      const streak2 = (id: string) => prevAfternoon.has(id) && prev2Afternoon.has(id);
      const buildAft = (tk: TypeKey, fixedList: Nurse[]) => {
        const pool = getAvailableByGen(tk);
        let flat = (["1", "2", "3"] as const).flatMap((g) => pool[g] || []).filter((n) => !daySched.afternoon.includes(n.id));
        if (!offDay) flat = flat.filter((n) => !nightSet.has(n.id));
        flat.sort((a, b) =>
          consecSoft
            ? (prevAfternoon.has(a.id) ? 1 : 0) - (prevAfternoon.has(b.id) ? 1 : 0) || cmpBy(tk)(a, b)
            : cmpBy(tk)(a, b),
        );
        const primary = flat.filter((n) => !streak2(n.id));
        const fallback = flat.filter((n) => streak2(n.id));
        const team: Nurse[] = [];
        const uG = new Set<string>();
        fixedList.forEach((n) => {
          if (team.length < 3 && !daySched.afternoon.includes(n.id)) {
            team.push(n);
            uG.add(n.generation);
          }
        });
        [...primary, ...fallback].forEach((n) => {
          if (team.length < 3 && !uG.has(n.generation)) {
            team.push(n);
            uG.add(n.generation);
          }
        });
        return team;
      };
      buildAft("afternoon1", fixedByShift.afternoon).forEach((n) => {
        daySched.afternoon.push(n.id);
        assign(n, "afternoon1");
      });
      buildAft("afternoon2", []).forEach((n) => {
        daySched.afternoon.push(n.id);
        assign(n, "afternoon2");
      });
    }

    // Fix เวรที่กะนั้นไม่ได้รันวันนี้ (เช่น fix เช้าในวันธรรมดา) → ใส่ตรง ๆ
    Object.keys(fixedByShift).forEach((sh) => {
      fixedByShift[sh].forEach((n) => {
        if (!daySched[sh].includes(n.id)) {
          daySched[sh].push(n.id);
          assign(n, sh === "morning" ? "morning1" : sh === "afternoon" ? "afternoon1" : sh);
        }
      });
    });

    monthSched[d] = daySched;
  }

  const totalAssigned = Object.values(monthSched).reduce(
    (sum, ds) => sum + STD_SHIFTS.reduce((s, k) => s + (ds[k]?.length || 0), 0),
    0,
  );
  return { monthSchedule: monthSched, warnings, totalAssigned };
}
