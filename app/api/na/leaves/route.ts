import type { LeaveType, NALeave } from "@/lib/types";
import { LEAVE_TYPES } from "@/lib/domain/leave";
import { matchAssistant } from "@/lib/domain/na";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { badRequest, isDate, json, newId, readJson, route, str } from "@/lib/server/http";
import { listAssistants } from "@/lib/server/repo/assistants";
import { insertNALeaveStmt } from "@/lib/server/repo/requests";
import { d } from "@/lib/server/summary";

export const POST = route(async (req) => {
  const actor = await requireNA(req);
  const b = await readJson<Partial<NALeave>>(req);
  const assistants = await listAssistants();
  let assistantId = str(b.assistantId, 64);
  if (actor.user.role === "assistant") {
    const mine = matchAssistant(assistants, actor.user);
    if (!mine) throw badRequest("บัญชีของคุณยังไม่ได้ผูกกับรายชื่อ NA กรุณาให้ผู้ดูแลผูกรหัสก่อน");
    assistantId = mine.id;
  }
  const a = assistants.find((x) => x.id === assistantId);
  const type = String(b.type) as LeaveType;
  if (!a || !isDate(b.dateFrom)) throw badRequest("กรุณาเลือกผู้ช่วยพยาบาลและวันที่");
  if (!LEAVE_TYPES[type]) throw badRequest("ประเภทการลาไม่ถูกต้อง");
  const dateTo = isDate(b.dateTo) ? b.dateTo : b.dateFrom;
  if (dateTo < b.dateFrom) throw badRequest("วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม");
  const leave: NALeave = {
    id: newId("NL"),
    assistantId,
    type,
    dateFrom: b.dateFrom,
    dateTo,
    reason: str(b.reason, 500),
    status: "pending",
    requestedBy: actor.username,
    approvedBy: "",
    createdAt: new Date().toISOString(),
  };
  await db().batch([
    insertNALeaveStmt(leave),
    auditStmt(actor, { action: "create", entity: "leave", entityId: leave.id, summary: `ขอ${LEAVE_TYPES[type]} ${a.name} ${d(b.dateFrom)}${dateTo !== b.dateFrom ? " ถึง " + d(dateTo) : ""}`, after: leave }),
  ]);
  return json({ ok: true });
});
