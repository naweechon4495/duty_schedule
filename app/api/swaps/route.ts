import type { Swap, SwapType } from "@/lib/types";
import { hasShiftOnDate, matchNurse } from "@/lib/domain/schedule";
import { SWAP_TYPE_LABELS } from "@/lib/domain/swap";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { requireNurse } from "@/lib/server/guard";
import { HttpError, badRequest, isDate, json, newId, readJson, route, str } from "@/lib/server/http";
import { listNurses } from "@/lib/server/repo/nurses";
import { insertSwapStmt } from "@/lib/server/repo/requests";
import { loadMonth } from "@/lib/server/repo/schedule";
import { d, shiftTH } from "@/lib/server/summary";

const SHIFTS = ["morning", "afternoon", "night", "preop", "preop_morning", "preop_afternoon"];

export const POST = route(async (req) => {
  const actor = await requireNurse(req);
  const role = actor.user.role;
  const b = await readJson<Partial<Swap>>(req);
  const type = String(b.type || "swap") as SwapType;
  if (!SWAP_TYPE_LABELS[type]) throw badRequest("ประเภทไม่ถูกต้อง");
  if (type === "substitute" && role === "requester") throw new HttpError(403, 'เฉพาะหัวหน้า (แอดมิน/ผู้อนุมัติ) เท่านั้นที่สร้าง "แทนเวร" ได้');

  const nurses = await listNurses();
  let from = str(b.from, 64);
  if (role === "requester") {
    const mine = matchNurse(nurses, actor.user);
    if (!mine) throw badRequest("บัญชีของคุณยังไม่ได้ผูกกับพยาบาล กรุณาให้แอดมินผูกรหัสพยาบาลก่อน");
    from = mine.id; // ผู้ยื่นคำขอขอได้เฉพาะเวรของตัวเอง
  }
  const to = str(b.to, 64);
  const date = b.date;
  const shift = String(b.shift || "");
  const shift2 = type === "swap" ? String(b.shift2 || shift) : shift;
  if (!from || !to || !isDate(date)) throw badRequest("กรุณากรอกข้อมูลให้ครบ");
  if (from === to) throw badRequest("ผู้ขอและผู้รับต้องเป็นคนละคน");
  if (!SHIFTS.includes(shift) || !SHIFTS.includes(shift2)) throw badRequest("กะไม่ถูกต้อง");
  const nFrom = nurses.find((n) => n.id === from);
  const nTo = nurses.find((n) => n.id === to);
  if (!nFrom || !nTo) throw badRequest("ไม่พบพยาบาล");
  const date2 = type === "swap" ? (isDate(b.date2) ? b.date2 : date) : date;

  // ตรวจว่ามีเวรนั้นจริงตามตาราง — ไม่มี = ห้ามบันทึก
  const schedule: Record<string, Awaited<ReturnType<typeof loadMonth>>> = {};
  for (const mk of new Set([date.slice(0, 7), date2.slice(0, 7)])) schedule[mk] = await loadMonth(mk);
  if (!hasShiftOnDate(schedule, from, date, shift))
    throw badRequest(`${nFrom.name} ไม่มีเวร "${shiftTH(shift)}" วันที่ ${d(date)} ตามตารางที่จัดไว้ — กรุณาตรวจสอบวันที่/กะ`);
  if (type === "swap" && !hasShiftOnDate(schedule, to, date2, shift2))
    throw badRequest(`${nTo.name} ไม่มีเวร "${shiftTH(shift2)}" วันที่ ${d(date2)} ตามตารางที่จัดไว้ — กรุณาตรวจสอบวันที่/กะของผู้รับแทน`);

  const swap: Swap = {
    id: newId("S"),
    type,
    from,
    to,
    date,
    date2,
    shift,
    shift2,
    reason: str(b.reason, 500),
    status: "pending",
    requestedBy: actor.username,
    approvedBy: "",
    createdAt: new Date().toISOString(),
    approvedAt: "",
  };
  const detail =
    type === "swap" && date2 !== date ? ` ↔ รับแทน ${d(date2)} กะ${shiftTH(shift2)}` : "";
  await db().batch([
    insertSwapStmt(swap),
    auditStmt(actor, {
      action: "create",
      entity: "swap",
      entityId: swap.id,
      summary: `สร้างคำขอ${SWAP_TYPE_LABELS[type]}: ${nFrom.name} → ${nTo.name} วันที่ ${d(date)} กะ${shiftTH(shift)}${detail}`,
      after: swap,
    }),
  ]);
  return json({ ok: true, swap });
});
