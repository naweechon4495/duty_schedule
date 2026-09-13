import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { badRequest, json, newId, readJson, route } from "@/lib/server/http";
import { insertNursesStmt, listNurses, sanitizeNurse } from "@/lib/server/repo/nurses";

/** นำเข้ารายชื่อจาก Excel (หน้าเว็บอ่านไฟล์แล้วส่งเป็นแถว) — ข้ามรหัสที่มีอยู่แล้ว */
export const POST = route(async (req) => {
  const actor = await requireNurse(req, NURSE_PERMS.manageNurses);
  const body = await readJson<{ rows?: { code?: string; name?: string; generation?: string; phone?: string }[] }>(req);
  const rows = body.rows || [];
  if (!rows.length) throw badRequest("ไม่มีข้อมูลในไฟล์");
  const existing = new Set((await listNurses()).map((n) => n.code));
  const added = [];
  const skipped: string[] = [];
  for (const r of rows.slice(0, 500)) {
    try {
      const n = sanitizeNurse({ code: r.code, name: r.name, generation: (r.generation || "1") as never, phone: r.phone }, newId("N"));
      if (existing.has(n.code)) {
        skipped.push(n.code);
        continue;
      }
      existing.add(n.code);
      added.push(n);
    } catch {
      skipped.push(String(r.code || "?"));
    }
  }
  if (added.length) {
    await db().batch([
      insertNursesStmt(added),
      auditStmt(actor, {
        action: "import",
        entity: "nurse",
        summary: `นำเข้าพยาบาลจาก Excel ${added.length} คน` + (skipped.length ? ` (ข้าม ${skipped.length} แถว)` : ""),
        after: added.map((n) => ({ code: n.code, name: n.name, generation: n.generation })),
      }),
    ]);
  }
  return json({ ok: true, added: added.length, skipped });
});
