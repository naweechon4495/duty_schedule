import type { Assistant } from "@/lib/types";
import { auditStmt, diffFields } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { HttpError, json, notFound, readJson, route } from "@/lib/server/http";
import { assistantCodeTaken, getAssistant, sanitizeAssistant, upsertAssistantStmt } from "@/lib/server/repo/assistants";
import { changeSummary } from "@/lib/server/summary";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNA(req, ["naadmin"]);
  const before = await getAssistant(id);
  if (!before) throw notFound("ไม่พบข้อมูลผู้ช่วยพยาบาล");
  const after = sanitizeAssistant(await readJson<Partial<Assistant>>(req), id);
  if (await assistantCodeTaken(after.code, id)) throw new HttpError(409, `รหัส ${after.code} มีอยู่แล้ว`);
  const diff = diffFields(before, after);
  if (!diff) return json({ ok: true, unchanged: true });
  await db().batch([
    upsertAssistantStmt(after, false),
    auditStmt(actor, { action: "update", entity: "assistant", entityId: id, summary: changeSummary(`แก้ไขผู้ช่วยพยาบาล ${before.code} ${before.name}`, diff.before, diff.after), before: diff.before, after: diff.after }),
  ]);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNA(req, ["naadmin"]);
  const before = await getAssistant(id);
  if (!before) throw notFound("ไม่พบข้อมูลผู้ช่วยพยาบาล");
  await db().batch([
    db().prepare("DELETE FROM assistants WHERE id = ?").bind(id),
    auditStmt(actor, { action: "delete", entity: "assistant", entityId: id, summary: `ลบผู้ช่วยพยาบาล ${before.code} ${before.name}`, before }),
  ]);
  return json({ ok: true });
});
