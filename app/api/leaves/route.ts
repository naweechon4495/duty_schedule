import type { Leave, LeaveType } from "@/lib/types";
import { LEAVE_TYPES } from "@/lib/domain/leave";
import { matchNurse } from "@/lib/domain/schedule";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { requireNurse } from "@/lib/server/guard";
import { badRequest, isDate, json, newId, readJson, route, str } from "@/lib/server/http";
import { listNurses } from "@/lib/server/repo/nurses";
import { insertLeaveStmt } from "@/lib/server/repo/requests";
import { d } from "@/lib/server/summary";

export const POST = route(async (req) => {
  const actor = await requireNurse(req);
  const b = await readJson<Partial<Leave>>(req);
  const nurses = await listNurses();
  let nurseId = str(b.nurseId, 64);
  if (actor.user.role === "requester") {
    const mine = matchNurse(nurses, actor.user);
    if (!mine) throw badRequest("บัญชีของคุณยังไม่ได้ผูกกับพยาบาล กรุณาให้แอดมินผูกรหัสพยาบาลก่อน");
    nurseId = mine.id;
  }
  const nurse = nurses.find((n) => n.id === nurseId);
  const type = String(b.type) as LeaveType;
  if (!nurse || !isDate(b.dateFrom)) throw badRequest("กรุณาเลือกพยาบาลและวันที่");
  if (!LEAVE_TYPES[type]) throw badRequest("ประเภทการลาไม่ถูกต้อง");
  const dateTo = isDate(b.dateTo) ? b.dateTo : b.dateFrom;
  if (dateTo < b.dateFrom) throw badRequest("วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม");
  const leave: Leave = {
    id: newId("L"),
    nurseId,
    type,
    dateFrom: b.dateFrom,
    dateTo,
    reason: str(b.reason, 500),
    status: "pending",
    requestedBy: actor.username,
    approvedBy: "",
    createdAt: new Date().toISOString(),
  };
  const range = dateTo === b.dateFrom ? d(b.dateFrom) : `${d(b.dateFrom)} ถึง ${d(dateTo)}`;
  await db().batch([
    insertLeaveStmt(leave),
    auditStmt(actor, { action: "create", entity: "leave", entityId: leave.id, summary: `ขอ${LEAVE_TYPES[type]} ${nurse.name} ${range}`, after: leave }),
  ]);
  return json({ ok: true, leave });
});
