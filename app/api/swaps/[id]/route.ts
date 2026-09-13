import type { MonthSchedule } from "@/lib/types";
import { SWAP_TYPE_LABELS, applySwap, swapMonths } from "@/lib/domain/swap";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { HttpError, badRequest, json, notFound, readJson, route } from "@/lib/server/http";
import { listNurses } from "@/lib/server/repo/nurses";
import { deleteSwapStmt, getSwap, setSwapStatusStmt } from "@/lib/server/repo/requests";
import { loadMonth, writeMonthStmts } from "@/lib/server/repo/schedule";
import { d, shiftTH } from "@/lib/server/summary";

type Ctx = { params: Promise<{ id: string }> };

/** อนุมัติ/ปฏิเสธ — อนุมัติแล้วเปลี่ยนตารางให้ทันทีใน transaction เดียวกัน */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.approve);
  const { status } = await readJson<{ status?: string }>(req);
  if (status !== "approved" && status !== "rejected") throw badRequest("สถานะไม่ถูกต้อง");
  const s = await getSwap(id);
  if (!s) throw notFound("ไม่พบคำขอ");
  if (s.status !== "pending") throw new HttpError(409, "คำขอนี้ถูกพิจารณาไปแล้ว");

  const nurses = await listNurses();
  const nm = (nid: string) => nurses.find((n) => n.id === nid)?.name || nid;
  const label = `${SWAP_TYPE_LABELS[s.type] || "แลกเวร"} ${nm(s.from)} → ${nm(s.to)} วันที่ ${d(s.date)} กะ${shiftTH(s.shift)}`;
  const now = new Date().toISOString();

  if (status === "rejected") {
    await db().batch([
      setSwapStatusStmt(id, "rejected", actor.username, now),
      auditStmt(actor, { action: "reject", entity: "swap", entityId: id, summary: `ปฏิเสธคำขอ${label}`, before: { status: s.status }, after: { status } }),
    ]);
    return json({ ok: true });
  }

  const months: Record<string, MonthSchedule> = {};
  for (const mk of swapMonths(s)) months[mk] = await loadMonth(mk);
  const applied = applySwap(months, s);
  const notApplied = !applied.first || applied.second === false;
  await db().batch([
    setSwapStatusStmt(id, "approved", actor.username, now),
    ...Object.entries(months).flatMap(([mk, ms]) => writeMonthStmts(mk, ms)),
    auditStmt(actor, {
      action: "approve",
      entity: "swap",
      entityId: id,
      summary: `อนุมัติคำขอ${label} — ` + (notApplied ? "⚠️ ไม่พบเวรเดิมในตารางบางส่วน (ตารางอาจถูกแก้ไปแล้ว)" : "เปลี่ยนในตารางแล้ว"),
      before: { status: s.status },
      after: { status, applied },
    }),
  ]);
  return json({ ok: true, applied, warning: notApplied ? "ไม่พบเวรเดิมในตารางบางส่วน ตารางอาจถูกแก้ไปแล้ว กรุณาตรวจสอบ" : undefined });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNurse(req, NURSE_PERMS.deleteRequests);
  const s = await getSwap(id);
  if (!s) throw notFound("ไม่พบคำขอ");
  await db().batch([
    deleteSwapStmt(id),
    auditStmt(actor, {
      action: "delete",
      entity: "swap",
      entityId: id,
      summary: `ลบคำขอ${SWAP_TYPE_LABELS[s.type] || "แลกเวร"} วันที่ ${d(s.date)} กะ${shiftTH(s.shift)} (${s.status})`,
      before: s,
    }),
  ]);
  return json({ ok: true });
});
