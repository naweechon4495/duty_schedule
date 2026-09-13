import type { Nurse } from "@/lib/types";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { HttpError, json, newId, readJson, route } from "@/lib/server/http";
import { codeTaken, insertNurseStmt, sanitizeNurse } from "@/lib/server/repo/nurses";

export const POST = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.manageNurses);
  const nurse = sanitizeNurse(await readJson<Partial<Nurse>>(req), newId("N"));
  if (await codeTaken(nurse.code)) throw new HttpError(409, `รหัส ${nurse.code} มีอยู่แล้ว`);
  await db().batch([
    insertNurseStmt(nurse),
    auditStmt(actor, {
      action: "create",
      entity: "nurse",
      entityId: nurse.id,
      summary: `เพิ่มพยาบาล ${nurse.code} ${nurse.name} (รุ่น ${nurse.generation})`,
      after: nurse,
    }),
  ]);
  return json({ ok: true, nurse });
});
