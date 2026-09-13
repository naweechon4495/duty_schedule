import type { Nurse } from "@/lib/types";
import { auditStmt, diffFields } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { HttpError, json, notFound, readJson, route } from "@/lib/server/http";
import { codeTaken, deleteNurseStmt, getNurse, sanitizeNurse, updateNurseStmt } from "@/lib/server/repo/nurses";
import { changeSummary } from "@/lib/server/summary";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.manageNurses);
  const before = await getNurse(id);
  if (!before) throw notFound("ไม่พบข้อมูลพยาบาล");
  const after = sanitizeNurse(await readJson<Partial<Nurse>>(req), id);
  if (await codeTaken(after.code, id)) throw new HttpError(409, `รหัส ${after.code} มีอยู่แล้ว`);
  const diff = diffFields(before, after);
  if (!diff) return json({ ok: true, nurse: after, unchanged: true });
  await db().batch([
    updateNurseStmt(after),
    auditStmt(actor, {
      action: "update",
      entity: "nurse",
      entityId: id,
      summary: changeSummary(`แก้ไขพยาบาล ${before.code} ${before.name}`, diff.before, diff.after),
      before: diff.before,
      after: diff.after,
    }),
  ]);
  return json({ ok: true, nurse: after });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.manageNurses);
  const before = await getNurse(id);
  if (!before) throw notFound("ไม่พบข้อมูลพยาบาล");
  await db().batch([
    deleteNurseStmt(id),
    auditStmt(actor, {
      action: "delete",
      entity: "nurse",
      entityId: id,
      summary: `ลบพยาบาล ${before.code} ${before.name}`,
      before,
    }),
  ]);
  return json({ ok: true });
});
