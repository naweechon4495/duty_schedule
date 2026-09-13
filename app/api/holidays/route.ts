import { makeHolidayCalendar } from "@/lib/domain/holidays";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { HttpError, badRequest, isDate, json, readJson, route, str } from "@/lib/server/http";
import { getHoliday } from "@/lib/server/repo/misc";
import { d } from "@/lib/server/summary";

export const POST = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.manageHolidays);
  const body = await readJson<{ date?: string; name?: string }>(req);
  const name = str(body.name, 200);
  if (!isDate(body.date) || !name) throw badRequest("กรุณากรอกข้อมูลให้ครบ");
  if (makeHolidayCalendar([]).isOfficialHoliday(body.date)) throw badRequest("วันที่นี้เป็นวันหยุดนักขัตฤกษ์อยู่แล้ว");
  if (await getHoliday(body.date)) throw new HttpError(409, "มีวันหยุดนี้อยู่แล้ว");
  await db().batch([
    db().prepare("INSERT INTO holidays (date, name) VALUES (?, ?)").bind(body.date, name),
    auditStmt(actor, { action: "create", entity: "holiday", entityId: body.date, summary: `เพิ่มวันหยุดพิเศษ ${d(body.date)} "${name}"`, after: { date: body.date, name } }),
  ]);
  return json({ ok: true });
});
