import type { MonthSchedule } from "@/lib/types";
import { addDays, dateStrOf, daysInMonth } from "@/lib/domain/dates";
import { SLOT_LABELS, emptyDay, hasAnyShift, isOnLeave } from "@/lib/domain/schedule";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { badRequest, isDate, isMonth, json, readJson, route, str } from "@/lib/server/http";
import { listNurses } from "@/lib/server/repo/nurses";
import { listLeaves } from "@/lib/server/repo/requests";
import { loadMonth, writeMonthStmts } from "@/lib/server/repo/schedule";

interface Body {
  name?: string;
  slot?: string;
  scope?: "month" | "range" | "day";
  month?: string;
  from?: string;
  to?: string;
  day?: string;
  pick?: "random" | "manual";
  count?: number;
  manualIds?: string[];
  gens?: string[];
  excludeIds?: string[];
}

/** เพิ่มเวรกำหนดเอง (port จาก saveCustomShift) — สุ่มคนฝั่งเซิร์ฟเวอร์จากข้อมูลล่าสุด */
export const POST = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.runSchedule);
  const b = await readJson<Body>(req);
  const name = str(b.name, 100);
  if (!name) throw badRequest("กรุณาใส่ชื่อเวร");
  if (name.includes("|")) throw badRequest("ชื่อเวรห้ามมีอักขระ |");
  const slot = String(b.slot);
  if (!SLOT_LABELS[slot]) throw badRequest("กะเวลาไม่ถูกต้อง");
  const key = slot + "|" + name;

  const dates: string[] = [];
  if (b.scope === "month") {
    if (!isMonth(b.month)) throw badRequest("เดือนไม่ถูกต้อง");
    for (let i = 1; i <= daysInMonth(b.month); i++) dates.push(dateStrOf(b.month, i));
  } else if (b.scope === "day") {
    if (!isDate(b.day)) throw badRequest("กรุณาเลือกวันที่");
    dates.push(b.day);
  } else {
    if (!isDate(b.from) || !isDate(b.to)) throw badRequest("กรุณาเลือกช่วงวันที่");
    let [f, t] = [b.from, b.to];
    if (f > t) [f, t] = [t, f];
    for (let cur = f, guard = 0; cur <= t && guard < 400; cur = addDays(cur, 1), guard++) dates.push(cur);
  }

  const count = Math.max(1, Math.min(50, Number(b.count) || 1));
  const [nurses, leaves] = await Promise.all([listNurses(), listLeaves()]);
  const valid = new Set(nurses.map((n) => n.id));
  const manualIds = (b.manualIds || []).map(String).filter((id) => valid.has(id));
  if (b.pick === "manual" && !manualIds.length) throw badRequest("กรุณาเลือกพยาบาลอย่างน้อย 1 คน");
  const gens = new Set((b.gens || []).map(String));
  if (b.pick !== "manual" && !gens.size) throw badRequest("กรุณาเลือกรุ่นที่นำไปสุ่มอย่างน้อย 1 รุ่น");
  const exclude = new Set((b.excludeIds || []).map(String));

  const months: Record<string, MonthSchedule> = {};
  for (const mk of new Set(dates.map((x) => x.slice(0, 7)))) months[mk] = await loadMonth(mk);

  let added = 0;
  for (const dateStr of dates) {
    const ms = months[dateStr.slice(0, 7)];
    const dn = parseInt(dateStr.slice(8, 10), 10);
    const ds = (ms[dn] ||= emptyDay());
    const list = (ds[key] ||= []);
    let pickIds: string[];
    if (b.pick === "manual") pickIds = manualIds;
    else {
      const free = nurses.filter(
        (n) => gens.has(String(n.generation)) && !exclude.has(n.id) && !hasAnyShift(ds, n.id) && !isOnLeave(leaves, n.id, dateStr) && !list.includes(n.id),
      );
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [free[i], free[j]] = [free[j], free[i]];
      }
      pickIds = free.slice(0, count).map((n) => n.id);
    }
    pickIds.forEach((id) => {
      if (!list.includes(id)) {
        list.push(id);
        added++;
      }
    });
  }

  const range = dates.length === 1 ? dates[0] : `${dates[0]} ถึง ${dates[dates.length - 1]}`;
  await db().batch([
    ...Object.entries(months).flatMap(([mk, ms]) => writeMonthStmts(mk, ms)),
    auditStmt(actor, {
      action: "create",
      entity: "schedule",
      entityId: key,
      summary: `เพิ่มเวรกำหนดเอง "${name}" (กะ${SLOT_LABELS[slot]}) ${range} — ${added} คน-วัน (${b.pick === "manual" ? "เลือกเอง" : "สุ่ม"})`,
      after: { key, dates: dates.length, added },
    }),
  ]);
  return json({ ok: true, added });
});
