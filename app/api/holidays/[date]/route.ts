import { makeHolidayCalendar } from "@/lib/domain/holidays";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { HttpError, badRequest, isDate, json, notFound, readJson, route, str } from "@/lib/server/http";
import { getHoliday } from "@/lib/server/repo/misc";
import { d } from "@/lib/server/summary";

type Ctx = { params: Promise<{ date: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const { date } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.manageHolidays);
  const before = await getHoliday(date);
  if (!before) throw notFound("ไม่พบวันหยุด");
  const body = await readJson<{ date?: string; name?: string }>(req);
  const name = str(body.name, 200);
  if (!isDate(body.date) || !name) throw badRequest("กรุณากรอกข้อมูลให้ครบ");
  if (makeHolidayCalendar([]).isOfficialHoliday(body.date)) throw badRequest("วันที่นี้เป็นวันหยุดนักขัตฤกษ์อยู่แล้ว");
  if (body.date !== date && (await getHoliday(body.date))) throw new HttpError(409, "มีวันหยุดนี้อยู่แล้ว");
  await db().batch([
    db().prepare("UPDATE holidays SET date = ?, name = ? WHERE date = ?").bind(body.date, name, date),
    auditStmt(actor, {
      action: "update",
      entity: "holiday",
      entityId: body.date,
      summary: `แก้วันหยุดพิเศษ ${d(before.date)} "${before.name}" → ${d(body.date)} "${name}"`,
      before,
      after: { date: body.date, name },
    }),
  ]);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { date } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.manageHolidays);
  const before = await getHoliday(date);
  if (!before) throw notFound("ไม่พบวันหยุด");
  await db().batch([
    db().prepare("DELETE FROM holidays WHERE date = ?").bind(date),
    auditStmt(actor, { action: "delete", entity: "holiday", entityId: date, summary: `ลบวันหยุดพิเศษ ${d(date)} "${before.name}"`, before }),
  ]);
  return json({ ok: true });
});
