import { LEAVE_TYPES } from "@/lib/domain/leave";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { HttpError, badRequest, json, notFound, readJson, route } from "@/lib/server/http";
import { getNurse } from "@/lib/server/repo/nurses";
import { deleteLeaveStmt, getLeave, setLeaveStatusStmt } from "@/lib/server/repo/requests";
import { d } from "@/lib/server/summary";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.approve);
  const { status } = await readJson<{ status?: string }>(req);
  if (status !== "approved" && status !== "rejected") throw badRequest("สถานะไม่ถูกต้อง");
  const l = await getLeave(id);
  if (!l) throw notFound("ไม่พบคำขอลา");
  if (l.status !== "pending") throw new HttpError(409, "คำขอนี้ถูกพิจารณาไปแล้ว");
  const nurse = await getNurse(l.nurseId);
  const range = l.dateTo === l.dateFrom ? d(l.dateFrom) : `${d(l.dateFrom)} ถึง ${d(l.dateTo)}`;
  await db().batch([
    setLeaveStatusStmt(id, status, status === "approved" ? actor.username : ""),
    auditStmt(actor, {
      action: status === "approved" ? "approve" : "reject",
      entity: "leave",
      entityId: id,
      summary: `${status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}${LEAVE_TYPES[l.type] || "การลา"} ${nurse?.name ?? l.nurseId} ${range}`,
      before: { status: l.status },
      after: { status },
    }),
  ]);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.deleteRequests);
  const l = await getLeave(id);
  if (!l) throw notFound("ไม่พบคำขอลา");
  const nurse = await getNurse(l.nurseId);
  await db().batch([
    deleteLeaveStmt(id),
    auditStmt(actor, {
      action: "delete",
      entity: "leave",
      entityId: id,
      summary: `ลบคำขอ${LEAVE_TYPES[l.type] || "ลา"} ${nurse?.name ?? l.nurseId} ${d(l.dateFrom)} (${l.status})`,
      before: l,
    }),
  ]);
  return json({ ok: true });
});
