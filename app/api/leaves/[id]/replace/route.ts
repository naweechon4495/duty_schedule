import { replaceInShift } from "@/lib/domain/schedule";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { badRequest, isDate, json, notFound, readJson, route, str } from "@/lib/server/http";
import { listNurses } from "@/lib/server/repo/nurses";
import { getLeave } from "@/lib/server/repo/requests";
import { loadMonth, writeMonthStmts } from "@/lib/server/repo/schedule";
import { d, shiftTH } from "@/lib/server/summary";

type Ctx = { params: Promise<{ id: string }> };

/** ใส่คนขึ้นแทนในเวรที่ทับวันลา (port จาก applyReplacement) */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.approve);
  const l = await getLeave(id);
  if (!l) throw notFound("ไม่พบคำขอลา");
  const b = await readJson<{ date?: string; shift?: string; replacementId?: string }>(req);
  if (!isDate(b.date) || b.date < l.dateFrom || b.date > l.dateTo) throw badRequest("วันที่ไม่อยู่ในช่วงลา");
  const shift = str(b.shift, 200);
  const replId = str(b.replacementId, 64);
  const nurses = await listNurses();
  const sick = nurses.find((n) => n.id === l.nurseId);
  const repl = nurses.find((n) => n.id === replId);
  if (!repl) throw badRequest("ไม่พบพยาบาลที่จะขึ้นแทน");

  const month = b.date.slice(0, 7);
  const ms = await loadMonth(month);
  const ds = ms[parseInt(b.date.slice(8, 10), 10)];
  if (!ds || !replaceInShift(ds, shift, l.nurseId, replId)) throw badRequest("ไม่พบเวรนี้ในตาราง (อาจถูกเปลี่ยนไปแล้ว)");
  await db().batch([
    ...writeMonthStmts(month, ms),
    auditStmt(actor, {
      action: "update",
      entity: "schedule",
      entityId: b.date,
      summary: `ใส่ ${repl.name} ขึ้นแทน ${sick?.name ?? l.nurseId} (ลา) วันที่ ${d(b.date)} กะ${shiftTH(shift)}`,
      before: { shift, nurseId: l.nurseId },
      after: { shift, nurseId: replId },
    }),
  ]);
  return json({ ok: true });
});
