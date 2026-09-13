import type { Swap } from "@/lib/types";
import { NA_SHIFT_LABELS, matchAssistant, naShiftOnDate } from "@/lib/domain/na";
import { SWAP_TYPE_LABELS } from "@/lib/domain/swap";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { badRequest, isDate, json, newId, readJson, route, str } from "@/lib/server/http";
import { listAssistants } from "@/lib/server/repo/assistants";
import { insertSwapStmt } from "@/lib/server/repo/requests";
import { NA_SLOTS, loadMonth } from "@/lib/server/repo/schedule";
import { d } from "@/lib/server/summary";

export const POST = route(async (req) => {
  const actor = await requireNA(req);
  const b = await readJson<Partial<Swap>>(req);
  const type = b.type === "giveaway" ? "giveaway" : "swap";
  const assistants = await listAssistants();
  let from = str(b.from, 64);
  if (actor.user.role === "assistant") {
    const mine = matchAssistant(assistants, actor.user);
    if (!mine) throw badRequest("บัญชีของคุณยังไม่ได้ผูกกับรายชื่อ NA กรุณาให้ผู้ดูแลผูกรหัสก่อน");
    from = mine.id;
  }
  const to = str(b.to, 64);
  const shift = String(b.shift || "");
  if (!from || !to || !isDate(b.date)) throw badRequest("กรุณากรอกข้อมูลให้ครบ");
  if (from === to) throw badRequest("ผู้ขอและผู้รับต้องเป็นคนละคน");
  if (!NA_SHIFT_LABELS[shift]) throw badRequest("กะไม่ถูกต้อง");
  const aFrom = assistants.find((a) => a.id === from);
  const aTo = assistants.find((a) => a.id === to);
  if (!aFrom || !aTo) throw badRequest("ไม่พบรายชื่อ NA");
  const date2 = type === "swap" && isDate(b.date2) ? b.date2 : b.date;

  const schedule = { [b.date.slice(0, 7)]: await loadMonth(b.date.slice(0, 7), NA_SLOTS) };
  if (!naShiftOnDate(schedule, from, b.date, shift)) throw badRequest(`${aFrom.name} ไม่มีเวร "${NA_SHIFT_LABELS[shift]}" วันที่ ${d(b.date)} ตามตาราง`);

  const swap: Swap = {
    id: newId("NS"),
    type,
    from,
    to,
    date: b.date,
    date2,
    shift,
    shift2: shift,
    reason: str(b.reason, 500),
    status: "pending",
    requestedBy: actor.username,
    approvedBy: "",
    createdAt: new Date().toISOString(),
    approvedAt: "",
  };
  await db().batch([
    insertSwapStmt(swap, "na_swaps"),
    auditStmt(actor, {
      action: "create",
      entity: "swap",
      entityId: swap.id,
      summary: `สร้างคำขอ${SWAP_TYPE_LABELS[type]}: ${aFrom.name} → ${aTo.name} วันที่ ${d(b.date)} กะ${NA_SHIFT_LABELS[shift]}` + (date2 !== b.date ? ` ↔ รับแทน ${d(date2)}` : ""),
      after: swap,
    }),
  ]);
  return json({ ok: true });
});
