import { monthTitleTH } from "@/lib/domain/dates";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { badRequest, isMonth, json, readJson, route, str } from "@/lib/server/http";
import { countSlots, loadMonth } from "@/lib/server/repo/schedule";
import { listSnapshots, snapshotStmt } from "@/lib/server/repo/snapshots";

export const dynamic = "force-dynamic";

/** รายการข้อมูลสำรองของเดือน (ไม่รวมตัวตาราง) */
export const GET = route(async (req) => {
  await requireNurse(req, NURSE_PERMS.runSchedule);
  const month = new URL(req.url).searchParams.get("month");
  if (!isMonth(month)) throw badRequest("เดือนไม่ถูกต้อง");
  return json({ snapshots: await listSnapshots(month) });
});

/** บันทึกสำรองตารางปัจจุบันของเดือน (กดเอง) */
export const POST = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.runSchedule);
  const body = await readJson<{ month?: string; note?: string }>(req);
  const month = body.month;
  if (!isMonth(month)) throw badRequest("เดือนไม่ถูกต้อง");
  const current = await loadMonth(month);
  if (!Object.keys(current).length) throw badRequest(`${monthTitleTH(month)} ยังไม่มีตารางให้สำรอง`);
  const note = str(body.note, 200);
  const slots = countSlots(current);
  await db().batch([
    snapshotStmt(month, "manual", actor, note),
    auditStmt(actor, {
      action: "snapshot",
      entity: "schedule",
      entityId: month,
      summary: `บันทึกสำรองตารางเวร ${monthTitleTH(month)} (${slots} กะ-คน)` + (note ? ` — ${note}` : ""),
      after: { slots, ...(note ? { note } : {}) },
    }),
  ]);
  return json({ ok: true });
});
