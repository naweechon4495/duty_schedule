import type { MonthSchedule } from "@/lib/types";
import { NA_SHIFT_LABELS, applyNASwap } from "@/lib/domain/na";
import { SWAP_TYPE_LABELS } from "@/lib/domain/swap";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { requireNA } from "@/lib/server/guard";
import { HttpError, badRequest, json, notFound, readJson, route } from "@/lib/server/http";
import { listAssistants } from "@/lib/server/repo/assistants";
import { deleteSwapStmt, getSwap, setSwapStatusStmt } from "@/lib/server/repo/requests";
import { NA_SLOTS, loadMonth, writeMonthStmts } from "@/lib/server/repo/schedule";
import { d } from "@/lib/server/summary";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNA(req, ["naadmin"]);
  const { status } = await readJson<{ status?: string }>(req);
  if (status !== "approved" && status !== "rejected") throw badRequest("สถานะไม่ถูกต้อง");
  const s = await getSwap(id, "na_swaps");
  if (!s) throw notFound("ไม่พบคำขอ");
  if (s.status !== "pending") throw new HttpError(409, "คำขอนี้ถูกพิจารณาไปแล้ว");
  const assistants = await listAssistants();
  const nm = (x: string) => assistants.find((a) => a.id === x)?.name || x;
  const label = `${SWAP_TYPE_LABELS[s.type] || "แลกเวร"} ${nm(s.from)} → ${nm(s.to)} วันที่ ${d(s.date)} กะ${NA_SHIFT_LABELS[s.shift] || s.shift}`;
  const now = new Date().toISOString();

  if (status === "rejected") {
    await db().batch([
      setSwapStatusStmt(id, "rejected", actor.username, now, "na_swaps"),
      auditStmt(actor, { action: "reject", entity: "swap", entityId: id, summary: `ปฏิเสธคำขอ${label}` }),
    ]);
    return json({ ok: true });
  }
  const months: Record<string, MonthSchedule> = {};
  for (const mk of new Set([s.date.slice(0, 7), s.date2.slice(0, 7)])) months[mk] = await loadMonth(mk, NA_SLOTS);
  const applied = applyNASwap(months, s);
  await db().batch([
    setSwapStatusStmt(id, "approved", actor.username, now, "na_swaps"),
    ...Object.entries(months).flatMap(([mk, ms]) => writeMonthStmts(mk, ms, NA_SLOTS)),
    auditStmt(actor, { action: "approve", entity: "swap", entityId: id, summary: `อนุมัติคำขอ${label} — ${applied.first ? "เปลี่ยนในตารางแล้ว" : "⚠️ ไม่พบเวรเดิมในตาราง"}`, after: { applied } }),
  ]);
  return json({ ok: true, warning: !applied.first || applied.second === false ? "ไม่พบเวรเดิมในตารางบางส่วน กรุณาตรวจสอบ" : undefined });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const actor = await requireNA(req, ["naadmin"]);
  const s = await getSwap(id, "na_swaps");
  if (!s) throw notFound("ไม่พบคำขอ");
  await db().batch([
    deleteSwapStmt(id, "na_swaps"),
    auditStmt(actor, { action: "delete", entity: "swap", entityId: id, summary: `ลบคำขอ${SWAP_TYPE_LABELS[s.type] || "แลกเวร"} วันที่ ${d(s.date)} (${s.status})`, before: s }),
  ]);
  return json({ ok: true });
});
