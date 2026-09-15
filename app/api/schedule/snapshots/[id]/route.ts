import { dateTimeTH, monthTitleTH } from "@/lib/domain/dates";
import { auditStmt } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { NURSE_PERMS, requireNurse } from "@/lib/server/guard";
import { json, notFound, route } from "@/lib/server/http";
import { getSnapshot, getSnapshotMeta, snapshotId } from "@/lib/server/repo/snapshots";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** ข้อมูลสำรอง 1 ชุดพร้อมตารางทั้งเดือน (ใช้ดูตัวอย่าง/ดาวน์โหลด Excel) */
export const GET = route<Ctx>(async (req, { params }) => {
  await requireNurse(req, NURSE_PERMS.runSchedule);
  const snap = await getSnapshot(snapshotId((await params).id));
  if (!snap) throw notFound("ไม่พบข้อมูลสำรองนี้");
  return json({ snapshot: snap });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const actor = await requireNurse(req, NURSE_PERMS.deleteSnapshot);
  const id = snapshotId((await params).id);
  const meta = await getSnapshotMeta(id);
  if (!meta) throw notFound("ไม่พบข้อมูลสำรองนี้");
  await db().batch([
    db().prepare("DELETE FROM schedule_snapshots WHERE id = ?").bind(id),
    auditStmt(actor, {
      action: "delete",
      entity: "schedule_snapshot",
      entityId: String(id),
      summary: `ลบข้อมูลสำรองตารางเวร ${monthTitleTH(meta.month)} ชุด #${id} (บันทึกเมื่อ ${dateTimeTH(meta.createdAt)}, ${meta.slots} กะ-คน)`,
      before: { slots: meta.slots, ...(meta.note ? { note: meta.note } : {}) },
    }),
  ]);
  return json({ ok: true });
});
