"use client";

import { Archive, ArchiveRestore, Eye, FileSpreadsheet, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNurseData } from "@/components/data/nurse-data";
import { FairnessTable } from "@/components/schedule/fairness-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { dateTimeTH, monthTitleTH } from "@/lib/domain/dates";
import { SNAPSHOT_AUTO_KEEP } from "@/lib/domain/schedule";
import { exportScheduleMatrix } from "@/lib/export/schedule";
import type { MonthSchedule, ScheduleSnapshot, SnapshotKind } from "@/lib/types";

type SnapshotFull = ScheduleSnapshot & { monthSchedule: MonthSchedule };

const KIND: Record<SnapshotKind, { label: string; cls: string }> = {
  manual: { label: "บันทึกเอง", cls: "bg-brand-100 text-brand-800" },
  initial: { label: "สำรองตอนติดตั้ง", cls: "bg-sky-100 text-sky-800" },
  before_auto: { label: "ก่อนจัดเวรอัตโนมัติ", cls: "bg-amber-100 text-amber-900" },
  before_clear: { label: "ก่อนล้างตาราง", cls: "bg-rose-100 text-rose-800" },
  before_restore: { label: "ก่อนกู้คืน", cls: "bg-violet-100 text-violet-800" },
  before_import: { label: "ก่อน Import", cls: "bg-slate-100 text-slate-700" },
};

const SHOW_FIRST = 5;
/** หมายเหตุของชนิดนี้ซ้ำกับป้ายชื่อ ไม่ต้องแสดง */
const GENERIC_NOTE_KINDS = new Set<SnapshotKind>(["before_auto", "before_clear", "before_import"]);

/** ช่องทั้งหมดของเดือนเป็นชุดข้อความ "วัน|กะ|คน" (ไม่นับ On call) — ใช้เทียบความต่าง */
function slotKeys(ms: MonthSchedule | undefined): Set<string> {
  const out = new Set<string>();
  for (const [day, ds] of Object.entries(ms || {}))
    for (const [shift, ids] of Object.entries(ds)) if (shift !== "night_oncall") (ids || []).forEach((id) => out.add(`${day}|${shift}|${id}`));
  return out;
}

/** สำรอง/ดู/กู้คืน ตารางเวรของเดือนที่เลือก (หน้าจัดเวร) */
export function SnapshotPanel({ month, reloadKey }: { month: string; reloadKey: number }) {
  const { me, schedule, nurses, cal, mutate } = useNurseData();
  const [items, setItems] = useState<ScheduleSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<SnapshotFull | null>(null);
  const [showAll, setShowAll] = useState(false);
  const current = schedule[month];
  const isAdmin = me.role === "admin";

  const load = useCallback(async () => {
    try {
      const r = await api<{ snapshots: ScheduleSnapshot[] }>(`/api/schedule/snapshots?month=${month}`, { loginPath: "/login" });
      setItems(r.snapshots);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลสำรองไม่สำเร็จ");
    }
  }, [month]);

  useEffect(() => {
    setItems(null);
    setShowAll(false);
    load();
  }, [load, reloadKey]);

  const fetchFull = async (s: ScheduleSnapshot) => (await api<{ snapshot: SnapshotFull }>(`/api/schedule/snapshots/${s.id}`, { loginPath: "/login" })).snapshot;

  const saveNow = async () => {
    setBusy("save");
    const done = await mutate(() => api("/api/schedule/snapshots", { body: { month, note } }), `บันทึกสำรองตาราง ${monthTitleTH(month)} แล้ว`);
    setBusy(null);
    if (done) {
      setNoteOpen(false);
      setNote("");
      load();
    }
  };

  const openView = async (s: ScheduleSnapshot) => {
    setBusy("view" + s.id);
    try {
      setView(await fetchFull(s));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "โหลดข้อมูลสำรองไม่สำเร็จ");
    }
    setBusy(null);
  };

  const excel = async (s: ScheduleSnapshot) => {
    setBusy("excel" + s.id);
    try {
      const full = view?.id === s.id ? view : await fetchFull(s);
      const stamp = s.createdAt.slice(0, 16).replace(/[-:T]/g, "");
      await exportScheduleMatrix(month, nurses, { [month]: full.monthSchedule }, cal, `ตารางเวร_${month}_สำรอง${s.id}_${stamp}.xlsx`);
    } catch (e) {
      toast.error("ดาวน์โหลดไม่สำเร็จ: " + (e instanceof Error ? e.message : e));
    }
    setBusy(null);
  };

  const restore = async (s: ScheduleSnapshot) => {
    const ok = await confirmDialog({
      title: `กู้คืนตาราง ${monthTitleTH(month)}`,
      message: (
        <>
          <p>
            แทนตารางทั้งเดือนด้วยข้อมูลสำรองชุด #{s.id} ({KIND[s.kind]?.label}, {dateTimeTH(s.createdAt)}) — {s.days} วัน {s.slots} กะ-คน
          </p>
          {current ? (
            <Alert tone="info" icon={<Archive />}>
              ตารางปัจจุบันจะถูก<b>สำรองไว้อัตโนมัติ</b>ก่อนกู้คืน ถ้ากู้ผิดชุดสามารถกู้กลับได้
            </Alert>
          ) : null}
        </>
      ),
      confirmText: "กู้คืน",
      tone: "danger",
      typeToConfirm: "กู้คืน",
    });
    if (!ok) return;
    setBusy("restore" + s.id);
    const done = await mutate(() => api(`/api/schedule/snapshots/${s.id}/restore`, { method: "POST" }), `กู้คืนตาราง ${monthTitleTH(month)} แล้ว`);
    setBusy(null);
    if (done) {
      setView(null);
      load();
    }
  };

  const remove = async (s: ScheduleSnapshot) => {
    const ok = await confirmDialog({
      title: `ลบข้อมูลสำรองชุด #${s.id}`,
      message: <p>ข้อมูลสำรอง ({KIND[s.kind]?.label}, {dateTimeTH(s.createdAt)}) จะถูกลบถาวร ตารางเวรปัจจุบันไม่เปลี่ยน</p>,
      confirmText: "ลบ",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("delete" + s.id);
    const done = await mutate(() => api(`/api/schedule/snapshots/${s.id}`, { method: "DELETE" }), "ลบข้อมูลสำรองแล้ว");
    setBusy(null);
    if (done) load();
  };

  const diff = (() => {
    if (!view) return null;
    const a = slotKeys(view.monthSchedule);
    const b = slotKeys(current);
    let onlySnap = 0;
    let onlyNow = 0;
    a.forEach((k) => !b.has(k) && onlySnap++);
    b.forEach((k) => !a.has(k) && onlyNow++);
    return { onlySnap, onlyNow };
  })();

  return (
    <Card>
      <CardHeader icon={<Archive className="size-5" />} title="สำรองตารางเวร" description={monthTitleTH(month)} />
      <CardBody className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm text-ink-soft">
            ระบบสำรองให้อัตโนมัติก่อนจัดเวร ล้างตาราง และกู้คืน (เก็บล่าสุด {SNAPSHOT_AUTO_KEEP} ชุด) ส่วนที่บันทึกเองเก็บไว้จนกว่าจะลบ
          </p>
          <Button variant="secondary" className="w-full sm:w-auto" disabled={!current} onClick={() => setNoteOpen(true)}>
            <Save /> บันทึกสำรองตอนนี้
          </Button>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        {!error && items === null && <p className="py-6 text-center text-sm text-ink-soft">กำลังโหลด...</p>}
        {items?.length === 0 && (
          <EmptyState icon={<Archive />} title="ยังไม่มีข้อมูลสำรองของเดือนนี้" description={current ? "กด “บันทึกสำรองตอนนี้” เพื่อเก็บตารางปัจจุบันไว้" : "เดือนนี้ยังไม่มีตาราง"} />
        )}
        {!!items?.length && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {(showAll ? items : items.slice(0, SHOW_FIRST)).map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={KIND[s.kind]?.cls || "bg-slate-100"}>{KIND[s.kind]?.label || s.kind}</Badge>
                    <span className="font-semibold text-ink">{dateTimeTH(s.createdAt)}</span>
                    <span className="text-xs text-ink-mute">#{s.id}</span>
                  </div>
                  <div className="mt-0.5 text-sm text-ink-soft">
                    {s.days} วัน · {s.slots} กะ-คน · โดย {s.createdByName || s.createdBy}
                  </div>
                  {s.note && !GENERIC_NOTE_KINDS.has(s.kind) && <div className="mt-0.5 text-sm text-ink">{s.note}</div>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" loading={busy === "view" + s.id} onClick={() => openView(s)}>
                    {busy !== "view" + s.id && <Eye />} ดู
                  </Button>
                  <Button size="sm" variant="outline" loading={busy === "excel" + s.id} onClick={() => excel(s)}>
                    {busy !== "excel" + s.id && <FileSpreadsheet />} Excel
                  </Button>
                  <Button size="sm" variant="secondary" loading={busy === "restore" + s.id} onClick={() => restore(s)}>
                    {busy !== "restore" + s.id && <ArchiveRestore />} กู้คืน
                  </Button>
                  {isAdmin && (
                    <Button size="icon-sm" variant="ghost" aria-label="ลบข้อมูลสำรอง" loading={busy === "delete" + s.id} onClick={() => remove(s)}>
                      {busy !== "delete" + s.id && <Trash2 className="text-rose-600" />}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {(items?.length || 0) > SHOW_FIRST && (
          <Button variant="ghost" size="sm" className="mt-2 w-full text-brand-700" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "แสดงเฉพาะล่าสุด" : `แสดงทั้งหมด ${items!.length} ชุด`}
          </Button>
        )}
      </CardBody>

      {noteOpen && (
        <Dialog
          open
          onOpenChange={(o) => !o && setNoteOpen(false)}
          title={`บันทึกสำรองตาราง ${monthTitleTH(month)}`}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setNoteOpen(false)}>
                ยกเลิก
              </Button>
              <Button loading={busy === "save"} onClick={saveNow}>
                {busy !== "save" && <Save />} บันทึก
              </Button>
            </>
          }
        >
          <Field label="หมายเหตุ (ไม่บังคับ)" hint="เช่น ตารางที่ประกาศแล้ว, ก่อนเปลี่ยนกฎดึก">
            <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ" />
          </Field>
        </Dialog>
      )}

      {view && (
        <Dialog
          open
          onOpenChange={(o) => !o && setView(null)}
          title={`ข้อมูลสำรองชุด #${view.id} — ${monthTitleTH(month)}`}
          description={`${KIND[view.kind]?.label} · ${dateTimeTH(view.createdAt)} · โดย ${view.createdByName || view.createdBy}`}
          size="xl"
          footer={
            <>
              <Button variant="outline" loading={busy === "excel" + view.id} onClick={() => excel(view)}>
                {busy !== "excel" + view.id && <FileSpreadsheet />} ดาวน์โหลด Excel
              </Button>
              <Button loading={busy === "restore" + view.id} onClick={() => restore(view)}>
                {busy !== "restore" + view.id && <ArchiveRestore />} กู้คืนชุดนี้
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {view.note && <p className="text-sm text-ink">{view.note}</p>}
            {diff && (
              <Alert tone={diff.onlySnap || diff.onlyNow ? "warn" : "success"}>
                {!current
                  ? "ตอนนี้เดือนนี้ไม่มีตาราง"
                  : diff.onlySnap || diff.onlyNow
                    ? `ต่างจากตารางปัจจุบัน: มีในชุดสำรองแต่ไม่มีในตอนนี้ ${diff.onlySnap} ช่อง · มีในตอนนี้แต่ไม่มีในชุดสำรอง ${diff.onlyNow} ช่อง`
                    : "เหมือนตารางปัจจุบันทุกช่อง"}
              </Alert>
            )}
            <div>
              <h3 className="mb-2 text-sm font-bold text-ink">จำนวนเวรต่อคนในชุดสำรอง</h3>
              <FairnessTable ms={view.monthSchedule} nurses={nurses} />
            </div>
          </div>
        </Dialog>
      )}
    </Card>
  );
}
