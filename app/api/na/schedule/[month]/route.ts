import type { MonthSchedule } from "@/lib/types";
import { monthTitleTH } from "@/lib/domain/dates";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { badRequest, isMonth, json, readJson, route } from "@/lib/server/http";
import { NA_SLOTS, countSlots, loadMonth, writeMonthStmts } from "@/lib/server/repo/schedule";

type Ctx = { params: Promise<{ month: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const { month } = await params;
  if (!isMonth(month)) throw badRequest("เดือนไม่ถูกต้อง");
  const actor = await requireNA(req, ["naadmin"]);
  const body = await readJson<{ monthSchedule?: MonthSchedule; warnings?: string[] }>(req);
  if (!body.monthSchedule || typeof body.monthSchedule !== "object") throw badRequest("ไม่มีข้อมูลตาราง");
  const before = await loadMonth(month, NA_SLOTS);
  const warnings = (body.warnings || []).slice(0, 100).map(String);
  await db().batch([
    ...writeMonthStmts(month, body.monthSchedule, NA_SLOTS),
    auditStmt(actor, {
      action: "auto_schedule",
      entity: "schedule",
      entityId: month,
      summary: `จัดเวร NA อัตโนมัติ ${monthTitleTH(month)} — ${countSlots(body.monthSchedule)} กะ-คน` + (Object.keys(before).length ? ` (เขียนทับตารางเดิม ${countSlots(before)} กะ-คน)` : ""),
      after: { slots: countSlots(body.monthSchedule), warnings },
    }),
  ]);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { month } = await params;
  if (!isMonth(month)) throw badRequest("เดือนไม่ถูกต้อง");
  const actor = await requireNA(req, ["naadmin"]);
  const before = await loadMonth(month, NA_SLOTS);
  await db().batch([
    writeMonthStmts(month, {}, NA_SLOTS)[0],
    auditStmt(actor, { action: "clear", entity: "schedule", entityId: month, summary: `ล้างตารางเวร NA ${monthTitleTH(month)} (${countSlots(before)} กะ-คน)` }),
  ]);
  return json({ ok: true });
});
