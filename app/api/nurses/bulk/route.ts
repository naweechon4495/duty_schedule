import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { badRequest, json, readJson, route } from "@/lib/server/http";
import { listNurses } from "@/lib/server/repo/nurses";

/** แก้รุ่นหลายคนพร้อมกัน */
export const POST = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.manageNurses);
  const body = await readJson<{ ids?: string[]; generation?: string }>(req);
  const ids = new Set((body.ids || []).map(String));
  const gen = String(body.generation || "");
  if (!ids.size) throw badRequest("กรุณาเลือกพยาบาลอย่างน้อย 1 คน");
  if (!["1", "2", "3", "4", "staff"].includes(gen)) throw badRequest("กรุณาเลือกรุ่น");
  const targets = (await listNurses()).filter((n) => ids.has(n.id) && n.generation !== gen);
  if (!targets.length) return json({ ok: true, count: 0 });
  await db().batch([
    db()
      .prepare("UPDATE nurses SET generation = ?, updated_at = ? WHERE id IN (SELECT value FROM json_each(?))")
      .bind(gen, new Date().toISOString(), JSON.stringify(targets.map((n) => n.id))),
    auditStmt(actor, {
      action: "update",
      entity: "nurse",
      entityId: "",
      summary: `แก้รุ่นหลายคนเป็นรุ่น ${gen} (${targets.length} คน): ` + targets.map((n) => n.code).join(", "),
      before: targets.map((n) => ({ id: n.id, code: n.code, generation: n.generation })),
      after: { generation: gen },
    }),
  ]);
  return json({ ok: true, count: targets.length });
});
