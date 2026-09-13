import { LEAVE_TYPES } from "@/lib/domain/leave";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { HttpError, badRequest, json, notFound, readJson, route } from "@/lib/server/http";
import { getAssistant } from "@/lib/server/repo/assistants";
import { deleteLeaveStmt, getNALeave, setLeaveStatusStmt } from "@/lib/server/repo/requests";
import { d } from "@/lib/server/summary";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNA(req, ["naadmin"]);
  const { status } = await readJson<{ status?: string }>(req);
  if (status !== "approved" && status !== "rejected") throw badRequest("สถานะไม่ถูกต้อง");
  const l = await getNALeave(id);
  if (!l) throw notFound("ไม่พบคำขอลา");
  if (l.status !== "pending") throw new HttpError(409, "คำขอนี้ถูกพิจารณาไปแล้ว");
  const a = await getAssistant(l.assistantId);
  await db().batch([
    setLeaveStatusStmt(id, status, status === "approved" ? actor.username : "", "na_leaves"),
    auditStmt(actor, {
      action: status === "approved" ? "approve" : "reject",
      entity: "leave",
      entityId: id,
      summary: `${status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}${LEAVE_TYPES[l.type] || "การลา"} ${a?.name ?? l.assistantId} ${d(l.dateFrom)}`,
    }),
  ]);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNA(req, ["naadmin"]);
  const l = await getNALeave(id);
  if (!l) throw notFound("ไม่พบคำขอลา");
  await db().batch([
    deleteLeaveStmt(id, "na_leaves"),
    auditStmt(actor, { action: "delete", entity: "leave", entityId: id, summary: `ลบคำขอลา ${d(l.dateFrom)} (${l.status})`, before: l }),
  ]);
  return json({ ok: true });
});
