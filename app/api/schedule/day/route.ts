import { DayEditError, EDIT_SLOTS, EDIT_SLOT_LABELS, applyDayEdit, type DayEdit, type EditSlot } from "@/lib/domain/dayEdit";
import { parseCustom } from "@/lib/domain/schedule";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { badRequest, isDate, json, readJson, route, str } from "@/lib/server/http";
import { listNurses } from "@/lib/server/repo/nurses";
import { loadMonth, writeMonthStmts } from "@/lib/server/repo/schedule";
import { d } from "@/lib/server/summary";

/** แอดมินแก้ตารางรายวัน: สร้างวันว่าง / เพิ่ม-ลบคนในกะ / สลับ On call / ลบเวรกำหนดเอง */
export const POST = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.editScheduleDay);
  const body = await readJson<{ date?: string; op?: string; slot?: string; nurseId?: string; key?: string }>(req);
  if (!isDate(body.date)) throw badRequest("วันที่ไม่ถูกต้อง");
  const date = body.date;
  const month = date.slice(0, 7);
  const day = parseInt(date.slice(8, 10), 10);

  let edit: DayEdit;
  const nurseId = str(body.nurseId, 64);
  if (body.op === "create") edit = { op: "create" };
  else if (body.op === "toggle_oncall") edit = { op: "toggle_oncall", personId: nurseId };
  else if (body.op === "remove_custom") edit = { op: "remove_custom", key: str(body.key, 200) };
  else if ((body.op === "add" || body.op === "remove") && EDIT_SLOTS.includes(body.slot as EditSlot))
    edit = { op: body.op, slot: body.slot as EditSlot, personId: nurseId };
  else throw badRequest("คำสั่งไม่ถูกต้อง");

  const [ms, nurses] = await Promise.all([loadMonth(month), listNurses()]);
  const nurse = nurses.find((n) => n.id === nurseId);
  if ((edit.op === "add" || edit.op === "remove" || edit.op === "toggle_oncall") && !nurse) throw badRequest("ไม่พบพยาบาล");

  let next;
  try {
    next = applyDayEdit(ms[day], edit);
  } catch (e) {
    if (e instanceof DayEditError) throw badRequest(e.message);
    throw e;
  }
  const who = nurse ? `${nurse.code} ${nurse.name}` : "";
  const summary =
    edit.op === "create" ? `สร้างวันว่าง ${d(date)} เพื่อแก้ไขเอง`
    : edit.op === "add" ? `เพิ่ม ${who} เข้ากะ${EDIT_SLOT_LABELS[edit.slot]} วันที่ ${d(date)}`
    : edit.op === "remove" ? `เอา ${who} ออกจากกะ${EDIT_SLOT_LABELS[edit.slot]} วันที่ ${d(date)}`
    : edit.op === "toggle_oncall" ? `สลับดึก On call ${who} วันที่ ${d(date)} → ${(next.night_oncall || []).includes(nurseId) ? "เป็น On call" : "ไม่เป็น On call"}`
    : `ลบเวรกำหนดเอง "${parseCustom(edit.key).name}" วันที่ ${d(date)}`;

  await db().batch([
    ...writeMonthStmts(month, { ...ms, [day]: next }),
    auditStmt(actor, { action: "update", entity: "schedule", entityId: date, summary, before: ms[day] ?? null, after: next }),
  ]);
  return json({ ok: true, day: next });
});
