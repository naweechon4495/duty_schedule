import type { MonthSchedule } from "@/lib/types";
import { monthTitleTH } from "@/lib/domain/dates";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { badRequest, isMonth, json, readJson, route } from "@/lib/server/http";
import { countSlots, loadMonth, writeMonthStmts } from "@/lib/server/repo/schedule";

type Ctx = { params: Promise<{ month: string }> };

/**
 * บันทึกตารางทั้งเดือน (ผลจากปุ่มจัดเวรอัตโนมัติ) — เขียนทับเดือนนั้นทั้งเดือน
 * หน้าเว็บคำนวณด้วย lib/domain/autoSchedule จากข้อมูลล่าสุด แล้วยืนยันกับผู้ใช้ก่อนส่ง
 */
export const PUT = route<Ctx>(async (req, { params }) => {
  const { month } = await params;
  if (!isMonth(month)) throw badRequest("เดือนไม่ถูกต้อง");
  const actor = await requireNurse(req, NURSE_PERMS.runSchedule);
  const body = await readJson<{ monthSchedule?: MonthSchedule; warnings?: string[] }>(req);
  const ms = body.monthSchedule;
  if (!ms || typeof ms !== "object") throw badRequest("ไม่มีข้อมูลตาราง");
  const before = await loadMonth(month);
  const warnings = (body.warnings || []).slice(0, 100).map(String);
  await db().batch([
    ...writeMonthStmts(month, ms),
    auditStmt(actor, {
      action: "auto_schedule",
      entity: "schedule",
      entityId: month,
      summary:
        `จัดเวรอัตโนมัติ ${monthTitleTH(month)} — ${countSlots(ms)} กะ-คน` +
        (Object.keys(before).length ? ` (เขียนทับตารางเดิม ${countSlots(before)} กะ-คน)` : "") +
        (warnings.length ? `, คำเตือน ${warnings.length} รายการ` : ""),
      after: { slots: countSlots(ms), warnings },
      before: Object.keys(before).length ? { slots: countSlots(before) } : undefined,
    }),
  ]);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { month } = await params;
  if (!isMonth(month)) throw badRequest("เดือนไม่ถูกต้อง");
  const actor = await requireNurse(req, NURSE_PERMS.runSchedule);
  const before = await loadMonth(month);
  await db().batch([
    ...writeMonthStmts(month, {}).slice(0, 1),
    auditStmt(actor, {
      action: "clear",
      entity: "schedule",
      entityId: month,
      summary: `ล้างตารางเวร ${monthTitleTH(month)} (${countSlots(before)} กะ-คน)`,
      before: { slots: countSlots(before) },
    }),
  ]);
  return json({ ok: true });
});
