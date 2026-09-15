import { dateTimeTH, monthTitleTH } from "@/lib/domain/dates";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { json, notFound, route } from "@/lib/server/http";
import { countSlots, loadMonth } from "@/lib/server/repo/schedule";
import { getSnapshotMeta, pruneAutoStmt, restoreStmts, snapshotId, snapshotStmt } from "@/lib/server/repo/snapshots";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * กู้คืนตารางทั้งเดือนจากข้อมูลสำรอง — สำรองตารางปัจจุบันไว้ก่อนใน batch เดียวกัน (กู้ผิดชุดก็ย้อนกลับได้)
 * ลำดับสำคัญ: สำรองตารางเดิม → ลบ/ใส่ตารางจากสำรอง → ค่อยลบสำรองอัตโนมัติเก่า (กันลบชุดที่กำลังกู้)
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const actor = await requireNurse(req, NURSE_PERMS.runSchedule);
  const id = snapshotId((await params).id);
  const meta = await getSnapshotMeta(id);
  if (!meta) throw notFound("ไม่พบข้อมูลสำรองนี้");
  const current = await loadMonth(meta.month);
  const hasCurrent = Object.keys(current).length > 0;
  await db().batch([
    snapshotStmt(meta.month, "before_restore", actor, `ตารางก่อนกู้คืนจากชุด #${id}`),
    ...restoreStmts(id, meta.month),
    pruneAutoStmt(meta.month),
    auditStmt(actor, {
      action: "restore",
      entity: "schedule",
      entityId: meta.month,
      summary:
        `กู้คืนตารางเวร ${monthTitleTH(meta.month)} จากข้อมูลสำรองชุด #${id} (บันทึกเมื่อ ${dateTimeTH(meta.createdAt)}) — ${meta.slots} กะ-คน` +
        (hasCurrent ? ` (ตารางเดิม ${countSlots(current)} กะ-คน สำรองไว้แล้ว)` : ""),
      before: hasCurrent ? { slots: countSlots(current) } : undefined,
      after: { slots: meta.slots, snapshotId: id },
    }),
  ]);
  return json({ ok: true });
});
