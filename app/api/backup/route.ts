import type { Holiday, Leave, Nurse, Schedule, Swap } from "@/lib/types";
import { auditStmt } from "@/lib/server/audit";
import { insertJsonRows } from "@/lib/server/bulk";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { badRequest, json, readJson, route } from "@/lib/server/http";
import { listHolidays, listUsers } from "@/lib/server/repo/misc";
import { insertNursesStmt, listNurses, sanitizeNurse } from "@/lib/server/repo/nurses";
import { listLeaves, listSwaps } from "@/lib/server/repo/requests";
import { loadSchedule, monthToRows } from "@/lib/server/repo/schedule";

export const dynamic = "force-dynamic";

/** Export สำรองข้อมูลทั้งหมด (ไม่มีรหัสผ่าน) */
export const GET = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.backup);
  const [nurses, schedule, swaps, leaves, holidays, users] = await Promise.all([
    listNurses(),
    loadSchedule(),
    listSwaps(),
    listLeaves(),
    listHolidays(),
    listUsers(),
  ]);
  await auditStmt(actor, { action: "export", entity: "data", summary: "Export ข้อมูลสำรอง (JSON)" }).run();
  return json({ app: "nawee-duty-schedule", version: 2, exportedAt: new Date().toISOString(), nurses, schedule, swaps, leaves, holidays, users });
});

/**
 * Import สำรอง: แทนที่ พยาบาล / ตารางเวร / คำขอแลกเวร / วันลา / วันหยุดพิเศษ ทั้งหมด
 * (ไม่แตะบัญชีผู้ใช้ เพราะไฟล์สำรองไม่มีรหัสผ่าน) — ต้องพิมพ์ยืนยัน
 */
export const POST = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.backup);
  const body = await readJson<{
    confirm?: string;
    data?: { nurses?: Nurse[]; schedule?: Schedule; swaps?: Swap[]; leaves?: Leave[]; holidays?: Holiday[]; customHolidays?: Holiday[] };
  }>(req);
  if (body.confirm !== "ยืนยัน") throw badRequest('กรุณาพิมพ์คำว่า "ยืนยัน"');
  const data = body.data;
  if (!data || !Array.isArray(data.nurses)) throw badRequest("ไฟล์สำรองไม่ถูกต้อง");

  const nurses = data.nurses.map((n) => sanitizeNurse(n, String(n.id)));
  const scheduleRows = Object.entries(data.schedule || {}).flatMap(([month, ms]) => monthToRows(ms).map((r) => [month, ...r]));
  const swaps = (data.swaps || []).map((s) => [s.id, s.type || "swap", s.from, s.to, s.date, s.date2 || s.date, s.shift, s.shift2 || "", s.reason || "", s.status, s.requestedBy || "", s.approvedBy || "", s.createdAt || "", s.approvedAt || ""]);
  const leaves = (data.leaves || []).map((l) => [l.id, l.nurseId, l.type, l.dateFrom, l.dateTo || l.dateFrom, l.reason || "", l.status, l.requestedBy || "", l.approvedBy || "", l.createdAt || ""]);
  const holidays = (data.holidays || data.customHolidays || []).map((h) => [h.date, h.name]);

  const stmts = [
    db().prepare("DELETE FROM nurses"),
    db().prepare("DELETE FROM schedule_slots"),
    db().prepare("DELETE FROM swaps"),
    db().prepare("DELETE FROM leaves"),
    db().prepare("DELETE FROM holidays"),
    nurses.length ? insertNursesStmt(nurses) : null,
    insertJsonRows("schedule_slots", ["month", "day", "shift", "position", "nurse_id"], scheduleRows),
    insertJsonRows("swaps", ["id", "type", "from_id", "to_id", "date", "date2", "shift", "shift2", "reason", "status", "requested_by", "approved_by", "created_at", "approved_at"], swaps),
    insertJsonRows("leaves", ["id", "nurse_id", "type", "date_from", "date_to", "reason", "status", "requested_by", "approved_by", "created_at"], leaves),
    insertJsonRows("holidays", ["date", "name"], holidays),
    auditStmt(actor, {
      action: "import",
      entity: "data",
      summary: `Import ข้อมูลสำรอง: พยาบาล ${nurses.length} คน, ตารางเวร ${Object.keys(data.schedule || {}).length} เดือน, แลกเวร ${swaps.length}, วันลา ${leaves.length}, วันหยุด ${holidays.length}`,
    }),
  ].filter((s): s is D1PreparedStatement => !!s);
  await db().batch(stmts);
  return json({ ok: true });
});
