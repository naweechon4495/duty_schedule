import type { Assistant } from "@/lib/types";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { HttpError, json, newId, readJson, route } from "@/lib/server/http";
import { assistantCodeTaken, sanitizeAssistant, upsertAssistantStmt } from "@/lib/server/repo/assistants";

export const POST = route(async (req) => {
  const actor = await requireNA(req, ["naadmin"]);
  const a = sanitizeAssistant(await readJson<Partial<Assistant>>(req), newId("A"));
  if (await assistantCodeTaken(a.code)) throw new HttpError(409, `รหัส ${a.code} มีอยู่แล้ว`);
  await db().batch([
    upsertAssistantStmt(a, true),
    auditStmt(actor, { action: "create", entity: "assistant", entityId: a.id, summary: `เพิ่มผู้ช่วยพยาบาล ${a.code} ${a.name}`, after: a }),
  ]);
  return json({ ok: true, assistant: a });
});
